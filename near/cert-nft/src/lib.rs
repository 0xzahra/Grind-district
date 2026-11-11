//! Grind District Certificate NFT (NEAR).
//!
//! Soulbound NEP-171 tokens for Grind District practice certificates. A certificate says a player
//! passed a course in the game. It is a practice credential, not an accredited qualification. It has
//! no money value and cannot be redeemed or transferred.
//!
//! Trust model, stated plainly:
//! - `nft_mint` needs a voucher signed (ed25519) by the game server's certificate key
//!   (`signer_pk`). The server signs only for the signed-in player's own username and a course their
//!   synced game save shows as passed. The save is written by the player's device, so this proves
//!   "the game issued this practice certificate", not a supervised exam.
//! - The voucher names the receiving NEAR account and the contract requires the caller to be that
//!   account, so a voucher cannot be used to mint into someone else's wallet.
//! - One certificate per (username, course). Tokens cannot be transferred or approved.
//! - Every identity field (course, title, name, username, rank, issued time WAT and ISO-8601,
//!   serial, certificate id, issuer, chain) is stored on-chain with the token. Only the image is
//!   served from `base_uri` (www.grinddistrict.app).
//! - The caller attaches NEAR to pay for the storage the token uses; any excess is refunded.

use near_sdk::json_types::{Base64VecU8, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::{self, json};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise, PublicKey};

pub const ISSUER: &str = "Grind District";
pub const CREDENTIAL: &str =
    "Practice credential, earned by passing the course in Grind District. Not an accredited qualification.";
pub const NFT_SPEC: &str = "nft-1.0.0";
const MAX_CERT_ID: usize = 640;

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    Tokens,
    ByOwner,
    ByKey,
}

/// Core certificate fields, stored on-chain with every token.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Certificate {
    pub course_id: String,
    pub course_title: String,
    pub player_name: String,
    pub username: String,
    pub rank: String,
    pub issued_at_ms: u64,
    pub issued_wat: String,
    pub issued_iso: String,
    pub serial: String,
    pub cert_id: String,
    pub minted_at_ms: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
struct Stored {
    owner_id: AccountId,
    cert: Certificate,
}

/// What the server signs: the exact UTF-8 JSON string is passed to `nft_mint` and verified.
#[derive(Deserialize, Serialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Voucher {
    pub contract_id: AccountId,
    pub receiver_id: AccountId,
    pub course_id: String,
    pub course_title: String,
    pub player_name: String,
    pub username: String,
    pub rank: String,
    pub issued_at_ms: u64,
    pub issued_wat: String,
    pub serial: String,
    pub cert_id: String,
    pub deadline_ms: u64,
}

/// NEP-177 contract metadata.
#[near(serializers = [json])]
pub struct NFTContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}

/// NEP-177 token metadata.
#[near(serializers = [json])]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<Base64VecU8>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}

/// NEP-171 token view, plus the on-chain certificate.
#[near(serializers = [json])]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
    pub approved_account_ids: std::collections::HashMap<AccountId, u64>,
    pub certificate: Certificate,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct CertNft {
    owner_id: AccountId,
    signer_pk: PublicKey,
    /// e.g. "https://www.grinddistrict.app/cert/"
    base_uri: String,
    next_id: u64,
    tokens: IterableMap<String, Stored>,
    by_owner: LookupMap<AccountId, Vec<String>>,
    /// "username\u{1f}course_id" -> token id
    by_key: LookupMap<String, String>,
}

fn printable(s: &str, min: usize, max: usize) -> bool {
    s.len() >= min && s.len() <= max && !s.chars().any(|c| c.is_control() || c == '"' || c == '\\')
}

/// Unix ms -> "YYYY-MM-DDTHH:MM:SS+01:00" in WAT (Africa/Lagos is UTC+1 all year).
pub fn iso_wat(ms: u64) -> String {
    let t = ms / 1000 + 3600;
    let z = (t / 86400) as i64 + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    let s = t % 86400;
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}+01:00", s / 3600, (s % 3600) / 60, s % 60)
}

fn key_of(username: &str, course_id: &str) -> String {
    format!("{}\u{1f}{}", username.to_lowercase(), course_id)
}

#[near]
impl CertNft {
    #[init]
    pub fn new(owner_id: AccountId, signer_pk: PublicKey, base_uri: String) -> Self {
        require!(signer_pk.curve_type() == near_sdk::CurveType::ED25519, "signer must be ed25519");
        Self {
            owner_id,
            signer_pk,
            base_uri,
            next_id: 0,
            tokens: IterableMap::new(StorageKey::Tokens),
            by_owner: LookupMap::new(StorageKey::ByOwner),
            by_key: LookupMap::new(StorageKey::ByKey),
        }
    }

    /// Mint with a server voucher. Caller must be `receiver_id` and attach storage (~0.01 NEAR; excess refunded).
    #[payable]
    pub fn nft_mint(&mut self, voucher: String, signature: Base64VecU8) -> JsonToken {
        let sig: [u8; 64] = signature.0.as_slice().try_into().unwrap_or_else(|_| env::panic_str("bad signature length"));
        let pk: [u8; 32] = self.signer_pk.as_bytes()[1..].try_into().unwrap_or_else(|_| env::panic_str("bad signer key"));
        require!(env::ed25519_verify(&sig, voucher.as_bytes(), &pk), "bad voucher signature");
        let v: Voucher = serde_json::from_str(&voucher).unwrap_or_else(|_| env::panic_str("bad voucher json"));
        require!(v.contract_id == env::current_account_id(), "voucher is for another contract");
        require!(v.receiver_id == env::predecessor_account_id(), "voucher is for another account");
        require!(env::block_timestamp_ms() <= v.deadline_ms, "voucher expired");
        require!(
            printable(&v.course_id, 1, 32)
                && printable(&v.course_title, 1, 160)
                && printable(&v.player_name, 0, 120)
                && printable(&v.username, 1, 16)
                && printable(&v.rank, 0, 48)
                && printable(&v.issued_wat, 0, 64)
                && printable(&v.serial, 1, 24)
                && printable(&v.cert_id, 1, MAX_CERT_ID),
            "bad field"
        );
        let key = key_of(&v.username, &v.course_id);
        if let Some(t) = self.by_key.get(&key) {
            env::panic_str(&format!("already minted as token {t}"));
        }

        let before = env::storage_usage();
        self.next_id += 1;
        let token_id = self.next_id.to_string();
        let owner = v.receiver_id.clone();
        let cert = Certificate {
            issued_iso: iso_wat(v.issued_at_ms),
            course_id: v.course_id,
            course_title: v.course_title,
            player_name: v.player_name,
            username: v.username,
            rank: v.rank,
            issued_at_ms: v.issued_at_ms,
            issued_wat: v.issued_wat,
            serial: v.serial,
            cert_id: v.cert_id,
            minted_at_ms: env::block_timestamp_ms(),
        };
        self.tokens.insert(token_id.clone(), Stored { owner_id: owner.clone(), cert });
        self.by_key.insert(key, token_id.clone());
        self.by_owner.entry(owner.clone()).or_default().push(token_id.clone());
        self.tokens.flush();
        self.by_key.flush();
        self.by_owner.flush();
        let used = env::storage_usage().saturating_sub(before);
        let cost = env::storage_byte_cost().saturating_mul(used as u128);
        let paid = env::attached_deposit();
        require!(paid >= cost, format!("attach at least {} yoctoNEAR for storage", cost.as_yoctonear()));
        let refund = paid.saturating_sub(cost);
        if refund > NearToken::from_yoctonear(1) {
            Promise::new(owner.clone()).transfer(refund).detach();
        }
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({"standard":"nep171","version":"1.2.0","event":"nft_mint","data":[{"owner_id": owner, "token_ids": [token_id], "memo": "Grind District practice certificate (soulbound)"}]})
        ));
        self.nft_token(token_id).expect("minted")
    }

    // ------------------------------------------------------------ soulbound: NEP-171 change methods refuse

    #[payable]
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>) {
        let _ = (receiver_id, token_id, approval_id, memo);
        env::panic_str("Soulbound: Grind District certificates cannot be transferred");
    }

    #[payable]
    pub fn nft_transfer_call(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>, msg: String) {
        let _ = (receiver_id, token_id, approval_id, memo, msg);
        env::panic_str("Soulbound: Grind District certificates cannot be transferred");
    }

    #[payable]
    pub fn nft_approve(&mut self, token_id: String, account_id: AccountId, msg: Option<String>) {
        let _ = (token_id, account_id, msg);
        env::panic_str("Soulbound: Grind District certificates cannot be approved");
    }

    pub fn nft_is_approved(&self, token_id: String, approved_account_id: AccountId, approval_id: Option<u64>) -> bool {
        let _ = (token_id, approved_account_id, approval_id);
        false
    }

    // ------------------------------------------------------------ views

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_SPEC.into(),
            name: "Grind District Certificate".into(),
            symbol: "GDCERT".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    pub fn nft_token(&self, token_id: String) -> Option<JsonToken> {
        self.tokens.get(&token_id).map(|s| self.view(&token_id, s))
    }

    pub fn nft_total_supply(&self) -> U64 {
        U64(self.tokens.len() as u64)
    }

    pub fn nft_tokens(&self, from_index: Option<U64>, limit: Option<u64>) -> Vec<JsonToken> {
        let from = from_index.map(|x| x.0).unwrap_or(0) as usize;
        self.tokens
            .iter()
            .skip(from)
            .take(limit.unwrap_or(50).min(100) as usize)
            .map(|(id, s)| self.view(id, s))
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U64 {
        U64(self.by_owner.get(&account_id).map(|v| v.len() as u64).unwrap_or(0))
    }

    pub fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U64>, limit: Option<u64>) -> Vec<JsonToken> {
        let ids = self.by_owner.get(&account_id).cloned().unwrap_or_default();
        ids.iter()
            .skip(from_index.map(|x| x.0).unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .filter_map(|id| self.nft_token(id.clone()))
            .collect()
    }

    /// The certificate for a username + course, if minted.
    pub fn cert_for(&self, username: String, course_id: String) -> Option<JsonToken> {
        self.by_key.get(&key_of(&username, &course_id)).and_then(|id| self.nft_token(id.clone()))
    }

    pub fn signer_pk(&self) -> PublicKey {
        self.signer_pk.clone()
    }

    // ------------------------------------------------------------ owner

    pub fn set_signer(&mut self, signer_pk: PublicKey) {
        self.only_owner();
        require!(signer_pk.curve_type() == near_sdk::CurveType::ED25519, "signer must be ed25519");
        self.signer_pk = signer_pk;
    }

    /// Only moves where the image/page is served. Stored certificate fields never change.
    pub fn set_base_uri(&mut self, base_uri: String) {
        self.only_owner();
        self.base_uri = base_uri;
    }

    fn only_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
    }

    fn view(&self, token_id: &str, s: &Stored) -> JsonToken {
        let c = &s.cert;
        let page = format!("{}{}", self.base_uri, c.cert_id);
        let name = if c.player_name.is_empty() { "A player".to_string() } else { c.player_name.clone() };
        let extra = json!({
            "issuer": ISSUER,
            "chain": "NEAR",
            "credential": CREDENTIAL,
            "transferable": false,
            "external_url": page,
            "attributes": [
                {"trait_type": "Course", "value": c.course_title},
                {"trait_type": "Course ID", "value": c.course_id},
                {"trait_type": "Player", "value": c.player_name},
                {"trait_type": "Username", "value": format!("@{}", c.username)},
                {"trait_type": "Rank at issue", "value": c.rank},
                {"trait_type": "Issued (WAT)", "value": c.issued_wat},
                {"trait_type": "Issued (ISO-8601)", "value": c.issued_iso},
                {"trait_type": "Certificate ID", "value": c.cert_id},
                {"trait_type": "Serial", "value": c.serial},
                {"trait_type": "Issuer", "value": ISSUER},
                {"trait_type": "Chain", "value": "NEAR"}
            ]
        });
        JsonToken {
            token_id: token_id.to_string(),
            owner_id: s.owner_id.clone(),
            metadata: TokenMetadata {
                title: Some(format!("{} - Grind District Certificate", c.course_title)),
                description: Some(format!(
                    "{name} (@{}) passed the {} course in Grind District. {CREDENTIAL} Non-transferable; no money value.",
                    c.username, c.course_title
                )),
                media: Some(format!("{page}/image.png")),
                media_hash: None,
                copies: Some(1),
                issued_at: Some(c.issued_at_ms.to_string()),
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: Some(extra.to_string()),
                reference: Some(format!("{page}/meta.json?chain=near")),
                reference_hash: None,
            },
            approved_account_ids: Default::default(),
            certificate: c.clone(),
        }
    }
}

#[cfg(test)]
mod tests;
