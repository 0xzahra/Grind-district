//! Grind District Skill Passport.
//!
//! An account-bound record of which Grind District courses an account says it has completed.
//!
//! Trust model, stated plainly: records are SELF-ATTESTED. The contract does not check answers
//! or any proof that a course was passed in the game. It only guarantees that:
//! - a record can only be written for the account that calls (`predecessor_account_id`),
//!   so nobody can write a record into someone else's passport;
//! - only known course IDs at their current version are accepted;
//! - recording the same course and version twice is a no-op that returns the first record;
//! - records cannot be edited, transferred or deleted.
//!
//! A record holds a course ID, a course version and a timestamp. No names, CV text, scores,
//! emails or other personal data. No tokens, no payments, no attached deposits.

use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, PanicOnDefault};

/// Shown by `passport_info` so any reader knows what a record does and does not prove.
pub const ATTESTATION: &str = "self-attested";
/// Upper bound on records per account. Each record costs storage paid by the contract,
/// so this caps what one account can make the contract store.
pub const MAX_RECORDS_PER_ACCOUNT: usize = 64;
/// Upper bound on the course catalogue, for the same reason.
pub const MAX_COURSES: u32 = 64;
const MAX_COURSE_ID_LEN: usize = 32;
const DEFAULT_PAGE: u32 = 50;
const EVENT_STANDARD: &str = "grind_skill_passport";
const EVENT_VERSION: &str = "1.0.0";

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    Courses,
    Completions,
}

/// One course in the catalogue at its current version.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CourseVersion {
    pub course_id: String,
    pub version: u16,
}

/// One completion record. Course ID, course version and block time only.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Completion {
    pub course_id: String,
    pub version: u16,
    /// Block timestamp when the record was written, in milliseconds since the Unix epoch.
    pub completed_at_ms: u64,
}

/// What this contract is, for readers and explorers.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PassportInfo {
    pub owner_id: AccountId,
    pub attestation: String,
    pub note: String,
    pub course_count: u32,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct SkillPassport {
    /// May add courses or bump a course version. Cannot write or change anyone's records.
    owner_id: AccountId,
    /// course_id -> current version.
    courses: IterableMap<String, u16>,
    /// account -> that account's records, in the order they were written.
    completions: LookupMap<AccountId, Vec<Completion>>,
}

fn valid_course_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_COURSE_ID_LEN
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
}

#[near]
impl SkillPassport {
    /// Create the passport with its course catalogue. Every course starts at the given version (>= 1).
    #[init]
    pub fn new(owner_id: AccountId, courses: Vec<CourseVersion>) -> Self {
        let mut this = Self {
            owner_id,
            courses: IterableMap::new(StorageKey::Courses),
            completions: LookupMap::new(StorageKey::Completions),
        };
        for course in courses {
            this.put_course(course.course_id, course.version);
        }
        this
    }

    // ---------- Writes ----------

    /// Record that the calling account completed `course_id` at `version`.
    ///
    /// The record is always written for `env::predecessor_account_id()`: there is no parameter
    /// that names another account. Calling again for the same course and version returns the
    /// first record unchanged.
    pub fn record_completion(&mut self, course_id: String, version: u16) -> Completion {
        let account = env::predecessor_account_id();
        let current = self.courses.get(&course_id).copied();
        require!(current.is_some(), "Unknown course");
        require!(current == Some(version), "Wrong course version");

        let mut records = self.completions.get(&account).cloned().unwrap_or_default();
        if let Some(existing) = records
            .iter()
            .find(|r| r.course_id == course_id && r.version == version)
        {
            return existing.clone();
        }
        require!(records.len() < MAX_RECORDS_PER_ACCOUNT, "Passport is full");

        let record = Completion {
            course_id,
            version,
            completed_at_ms: env::block_timestamp_ms(),
        };
        records.push(record.clone());
        self.completions.insert(account.clone(), records);

        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": EVENT_STANDARD,
                "version": EVENT_VERSION,
                "event": "completion_recorded",
                "data": [{
                    "account_id": account,
                    "course_id": record.course_id,
                    "version": record.version,
                    "completed_at_ms": record.completed_at_ms,
                    "attestation": ATTESTATION,
                }],
            })
        ));
        record
    }

    /// Owner only: add a course, or move an existing course to a new, higher version.
    /// Records made at an older version stay as they are.
    pub fn set_course(&mut self, course_id: String, version: u16) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the owner can change courses"
        );
        if let Some(current) = self.courses.get(&course_id).copied() {
            require!(version > current, "Version must go up");
        }
        self.put_course(course_id, version);
    }

    // ---------- Reads (view methods, free to call) ----------

    /// The account's record for `course_id` at the highest version it holds, if any.
    pub fn get_completion(&self, account_id: AccountId, course_id: String) -> Option<Completion> {
        self.completions.get(&account_id).and_then(|records| {
            records
                .iter()
                .filter(|r| r.course_id == course_id)
                .max_by_key(|r| r.version)
                .cloned()
        })
    }

    /// True when the account holds any record for `course_id`. Handy for gating a quest.
    pub fn has_completed(&self, account_id: AccountId, course_id: String) -> bool {
        self.get_completion(account_id, course_id).is_some()
    }

    /// The account's records in the order they were written, paged.
    pub fn list_completions(
        &self,
        account_id: AccountId,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<Completion> {
        let start = from_index.unwrap_or(0) as usize;
        let take = limit.unwrap_or(DEFAULT_PAGE).min(DEFAULT_PAGE) as usize;
        self.completions
            .get(&account_id)
            .map(|records| records.iter().skip(start).take(take).cloned().collect())
            .unwrap_or_default()
    }

    /// The course catalogue with current versions.
    pub fn get_courses(&self) -> Vec<CourseVersion> {
        self.courses
            .iter()
            .map(|(course_id, version)| CourseVersion {
                course_id: course_id.clone(),
                version: *version,
            })
            .collect()
    }

    pub fn passport_info(&self) -> PassportInfo {
        PassportInfo {
            owner_id: self.owner_id.clone(),
            attestation: ATTESTATION.to_string(),
            note: "Each record is written by the account it belongs to. It is not checked against the game, \
                   graded or accredited."
                .to_string(),
            course_count: self.courses.len(),
        }
    }
}

impl SkillPassport {
    fn put_course(&mut self, course_id: String, version: u16) {
        require!(valid_course_id(&course_id), "Bad course id");
        require!(version >= 1, "Version starts at 1");
        require!(
            self.courses.contains_key(&course_id) || self.courses.len() < MAX_COURSES,
            "Too many courses"
        );
        self.courses.insert(course_id, version);
    }
}

#[cfg(test)]
mod tests;
