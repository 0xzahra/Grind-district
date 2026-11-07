use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

/// The game's course IDs (src/logic.ts SKILL_ORDER), all at version 1.
const GAME_COURSES: [&str; 20] = [
    "spot",
    "risk",
    "staking",
    "airdrops",
    "memes",
    "agents",
    "building",
    "carbon",
    "custody",
    "stables",
    "liquidity",
    "records",
    "wallets",
    "explorer",
    "scams",
    "community",
    "content",
    "defi",
    "nfts",
    "daos",
];

fn acc(name: &str) -> AccountId {
    name.parse().unwrap()
}

/// Set who is calling. `predecessor` is the account the contract sees as the caller;
/// `signer` is who signed the transaction (differs when a contract calls on someone's behalf).
fn call_as(predecessor: &str, signer: &str, at_ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("passport.testnet"))
        .predecessor_account_id(acc(predecessor))
        .signer_account_id(acc(signer))
        .block_timestamp(at_ms * 1_000_000)
        .build());
}

fn catalogue() -> Vec<CourseVersion> {
    GAME_COURSES
        .iter()
        .map(|id| CourseVersion {
            course_id: id.to_string(),
            version: 1,
        })
        .collect()
}

fn fresh() -> SkillPassport {
    call_as("owner.testnet", "owner.testnet", 1_000);
    SkillPassport::new(acc("owner.testnet"), catalogue())
}

// ---------- Setup ----------

#[test]
fn init_loads_the_game_catalogue() {
    let c = fresh();
    let courses = c.get_courses();
    assert_eq!(courses.len(), GAME_COURSES.len());
    assert!(courses.iter().all(|cv| cv.version == 1));
    let info = c.passport_info();
    assert_eq!(info.attestation, "self-attested");
    assert_eq!(info.owner_id, acc("owner.testnet"));
    assert_eq!(info.course_count, 20);
}

#[test]
#[should_panic(expected = "Bad course id")]
fn init_rejects_a_malformed_course_id() {
    call_as("owner.testnet", "owner.testnet", 1_000);
    SkillPassport::new(
        acc("owner.testnet"),
        vec![CourseVersion {
            course_id: "Spot Trading!".into(),
            version: 1,
        }],
    );
}

#[test]
#[should_panic(expected = "Version starts at 1")]
fn init_rejects_version_zero() {
    call_as("owner.testnet", "owner.testnet", 1_000);
    SkillPassport::new(
        acc("owner.testnet"),
        vec![CourseVersion {
            course_id: "spot".into(),
            version: 0,
        }],
    );
}

// ---------- Record and read ----------

#[test]
fn records_a_completion_and_reads_it_back() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_700_000_000_000);
    let rec = c.record_completion("spot".into(), 1);
    assert_eq!(
        rec,
        Completion {
            course_id: "spot".into(),
            version: 1,
            completed_at_ms: 1_700_000_000_000
        }
    );

    assert_eq!(
        c.get_completion(acc("alice.testnet"), "spot".into()),
        Some(rec.clone())
    );
    assert!(c.has_completed(acc("alice.testnet"), "spot".into()));
    assert!(!c.has_completed(acc("alice.testnet"), "risk".into()));
    assert_eq!(
        c.list_completions(acc("alice.testnet"), None, None),
        vec![rec]
    );
}

#[test]
fn emits_one_event_marked_self_attested() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 5_000);
    c.record_completion("spot".into(), 1);
    let logs = get_logs();
    assert_eq!(logs.len(), 1);
    let log = &logs[0];
    assert!(log.starts_with("EVENT_JSON:"));
    let json: near_sdk::serde_json::Value =
        near_sdk::serde_json::from_str(&log["EVENT_JSON:".len()..]).unwrap();
    assert_eq!(json["standard"], "grind_skill_passport");
    assert_eq!(json["event"], "completion_recorded");
    assert_eq!(json["data"][0]["account_id"], "alice.testnet");
    assert_eq!(json["data"][0]["course_id"], "spot");
    assert_eq!(json["data"][0]["attestation"], "self-attested");
}

#[test]
fn unknown_account_reads_empty() {
    let c = fresh();
    assert_eq!(c.get_completion(acc("nobody.testnet"), "spot".into()), None);
    assert!(c
        .list_completions(acc("nobody.testnet"), None, None)
        .is_empty());
}

// ---------- Account binding ----------

#[test]
fn record_goes_to_the_caller_never_to_another_account() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 2_000);
    c.record_completion("spot".into(), 1);

    // Bob's passport is untouched by Alice's call, and Bob writing does not touch Alice's.
    assert!(c
        .list_completions(acc("bob.testnet"), None, None)
        .is_empty());
    call_as("bob.testnet", "bob.testnet", 3_000);
    c.record_completion("risk".into(), 1);
    assert_eq!(
        c.list_completions(acc("alice.testnet"), None, None).len(),
        1
    );
    assert!(!c.has_completed(acc("alice.testnet"), "risk".into()));
    assert!(!c.has_completed(acc("bob.testnet"), "spot".into()));
}

#[test]
fn signer_cannot_write_into_another_accounts_passport_through_a_middle_contract() {
    // Bob signs, but the call reaches the passport through alice-relay.testnet.
    // The record must land on the immediate caller (predecessor), never on the signer,
    // so a contract cannot be used to write records for whoever signed.
    let mut c = fresh();
    call_as("alice-relay.testnet", "bob.testnet", 4_000);
    c.record_completion("spot".into(), 1);
    assert!(c.has_completed(acc("alice-relay.testnet"), "spot".into()));
    assert!(!c.has_completed(acc("bob.testnet"), "spot".into()));
}

// ---------- Idempotency ----------

#[test]
fn duplicate_is_a_no_op_that_returns_the_first_record() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 10_000);
    let first = c.record_completion("spot".into(), 1);
    let logs_after_first = get_logs().len();

    call_as("alice.testnet", "alice.testnet", 99_000); // later block
    let again = c.record_completion("spot".into(), 1);
    assert_eq!(again, first, "the original timestamp is kept");
    assert_eq!(
        get_logs().len(),
        0,
        "no second event (fresh context has no logs)"
    );
    assert_eq!(logs_after_first, 1);
    assert_eq!(
        c.list_completions(acc("alice.testnet"), None, None).len(),
        1
    );
}

// ---------- Invalid courses ----------

#[test]
#[should_panic(expected = "Unknown course")]
fn unknown_course_is_rejected() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_000);
    c.record_completion("insider-trading".into(), 1);
}

#[test]
#[should_panic(expected = "Unknown course")]
fn empty_course_id_is_rejected() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_000);
    c.record_completion(String::new(), 1);
}

#[test]
#[should_panic(expected = "Wrong course version")]
fn wrong_version_is_rejected() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_000);
    c.record_completion("spot".into(), 2);
}

#[test]
fn rejected_write_leaves_no_record() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_000);
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.record_completion("nope".into(), 1);
    }));
    assert!(res.is_err());
    assert!(c
        .list_completions(acc("alice.testnet"), None, None)
        .is_empty());
}

// ---------- Persistence ----------

#[test]
fn records_survive_a_state_write_and_reload() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 7_000);
    let rec = c.record_completion("custody".into(), 1);
    // Persist the contract struct exactly as the runtime does after a call, drop it
    // (store collections flush on drop), then load a new instance from storage.
    env::state_write(&c);
    drop(c);

    call_as("reader.testnet", "reader.testnet", 8_000);
    let loaded: SkillPassport = env::state_read().expect("state was written");
    assert_eq!(
        loaded.get_completion(acc("alice.testnet"), "custody".into()),
        Some(rec)
    );
    assert_eq!(loaded.get_courses().len(), GAME_COURSES.len());
    assert_eq!(loaded.passport_info().owner_id, acc("owner.testnet"));
}

// ---------- Catalogue changes ----------

#[test]
#[should_panic(expected = "Only the owner can change courses")]
fn non_owner_cannot_add_courses() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_000);
    c.set_course("free-money".into(), 1);
}

#[test]
#[should_panic(expected = "Version must go up")]
fn owner_cannot_move_a_version_down() {
    let mut c = fresh();
    call_as("owner.testnet", "owner.testnet", 1_000);
    c.set_course("spot".into(), 2);
    c.set_course("spot".into(), 1);
}

#[test]
fn owner_version_bump_keeps_old_records_and_accepts_the_new_version() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_000);
    let v1 = c.record_completion("spot".into(), 1);

    call_as("owner.testnet", "owner.testnet", 2_000);
    c.set_course("spot".into(), 2);
    c.set_course("tokenized-stocks".into(), 1);
    assert!(c.get_courses().contains(&CourseVersion {
        course_id: "tokenized-stocks".into(),
        version: 1
    }));

    call_as("alice.testnet", "alice.testnet", 3_000);
    let v2 = c.record_completion("spot".into(), 2);
    assert_eq!(
        c.list_completions(acc("alice.testnet"), None, None),
        vec![v1, v2.clone()]
    );
    assert_eq!(
        c.get_completion(acc("alice.testnet"), "spot".into()),
        Some(v2),
        "highest version wins"
    );
}

#[test]
#[should_panic(expected = "Wrong course version")]
fn old_version_cannot_be_recorded_after_a_bump() {
    let mut c = fresh();
    call_as("owner.testnet", "owner.testnet", 1_000);
    c.set_course("spot".into(), 2);
    call_as("alice.testnet", "alice.testnet", 2_000);
    c.record_completion("spot".into(), 1);
}

#[test]
fn owner_cannot_write_records_for_others() {
    // The owner is just another caller for record_completion: its call lands on the owner's own passport.
    let mut c = fresh();
    call_as("owner.testnet", "owner.testnet", 1_000);
    c.record_completion("spot".into(), 1);
    assert!(c.has_completed(acc("owner.testnet"), "spot".into()));
    assert!(!c.has_completed(acc("alice.testnet"), "spot".into()));
}

// ---------- Bounds ----------

#[test]
fn list_is_paged() {
    let mut c = fresh();
    call_as("alice.testnet", "alice.testnet", 1_000);
    for id in GAME_COURSES.iter().take(5) {
        c.record_completion(id.to_string(), 1);
    }
    let page = c.list_completions(acc("alice.testnet"), Some(2), Some(2));
    assert_eq!(
        page.iter()
            .map(|r| r.course_id.as_str())
            .collect::<Vec<_>>(),
        vec!["staking", "airdrops"]
    );
    assert_eq!(
        c.list_completions(acc("alice.testnet"), Some(10), None),
        vec![]
    );
}

#[test]
fn passport_stops_at_the_per_account_cap() {
    let mut c = fresh();
    // 20 courses x versions: bump one course repeatedly so the account can collect 64 distinct records.
    call_as("alice.testnet", "alice.testnet", 1_000);
    for id in GAME_COURSES {
        c.record_completion(id.to_string(), 1);
    }
    let mut version = 1u16;
    while c
        .list_completions(acc("alice.testnet"), Some(0), Some(50))
        .len()
        < 50
        || c.list_completions(acc("alice.testnet"), Some(50), Some(50))
            .len()
            < MAX_RECORDS_PER_ACCOUNT - 50
    {
        version += 1;
        call_as("owner.testnet", "owner.testnet", 1_000);
        c.set_course("spot".into(), version);
        call_as("alice.testnet", "alice.testnet", 1_000);
        c.record_completion("spot".into(), version);
    }
    version += 1;
    call_as("owner.testnet", "owner.testnet", 1_000);
    c.set_course("spot".into(), version);
    call_as("alice.testnet", "alice.testnet", 1_000);
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.record_completion("spot".into(), version);
    }));
    let msg = res.expect_err("65th record is refused");
    let text = msg
        .downcast_ref::<String>()
        .cloned()
        .or_else(|| msg.downcast_ref::<&str>().map(|s| s.to_string()))
        .unwrap_or_default();
    assert!(
        text.contains("Passport is full"),
        "refused for the cap, got: {text}"
    );
    assert_eq!(
        c.list_completions(acc("alice.testnet"), Some(0), Some(50))
            .len()
            + c.list_completions(acc("alice.testnet"), Some(50), Some(50))
                .len(),
        MAX_RECORDS_PER_ACCOUNT
    );
}

#[test]
#[should_panic(expected = "Too many courses")]
fn catalogue_is_capped() {
    let mut c = fresh();
    call_as("owner.testnet", "owner.testnet", 1_000);
    for i in 0..=MAX_COURSES {
        c.set_course(format!("extra-{i}"), 1);
    }
}
