use super::*;
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

const NOW_MS: u64 = 1_794_386_533_000; // 2026-11-11T08:42:13Z

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn key() -> SigningKey {
    SigningKey::from_bytes(&[7u8; 32])
}

fn pk(k: &SigningKey) -> PublicKey {
    let mut b = vec![0u8];
    b.extend_from_slice(k.verifying_key().as_bytes());
    PublicKey::try_from(b).unwrap()
}

fn ctx(caller: &str, deposit: NearToken, at_ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("cert.grind.testnet"))
        .predecessor_account_id(acc(caller))
        .signer_account_id(acc(caller))
        .attached_deposit(deposit)
        .block_timestamp(at_ms * 1_000_000)
        .build());
}

fn setup() -> CertNft {
    ctx("owner.testnet", NearToken::from_yoctonear(0), NOW_MS);
    CertNft::new(acc("owner.testnet"), pk(&key()), "https://www.grinddistrict.app/cert/".into())
}

fn voucher(receiver: &str, course: &str, name: &str) -> String {
    serde_json::to_string(&Voucher {
        contract_id: acc("cert.grind.testnet"),
        receiver_id: acc(receiver),
        course_id: course.into(),
        course_title: "Spot trading".into(),
        player_name: name.into(),
        username: "amina".into(),
        rank: "Dolphin".into(),
        issued_at_ms: NOW_MS,
        issued_wat: "11 November 2026, 09:42 WAT".into(),
        serial: "GD-RN02-9BHY".into(),
        cert_id: "eyJ2IjoyfQ".into(),
        deadline_ms: NOW_MS + 1_800_000,
    })
    .unwrap()
}

fn sign(k: &SigningKey, json: &str) -> Base64VecU8 {
    Base64VecU8(k.sign(json.as_bytes()).to_bytes().to_vec())
}

fn storage() -> NearToken {
    NearToken::from_millinear(50)
}

#[test]
fn mints_with_full_on_chain_certificate() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    ctx("amina.testnet", storage(), NOW_MS + 1000);
    let t = c.nft_mint(v.clone(), sign(&key(), &v));
    assert_eq!(t.token_id, "1");
    assert_eq!(t.owner_id, acc("amina.testnet"));
    let cert = &t.certificate;
    assert_eq!(cert.course_id, "spot");
    assert_eq!(cert.course_title, "Spot trading");
    assert_eq!(cert.player_name, "Amina Bello");
    assert_eq!(cert.username, "amina");
    assert_eq!(cert.rank, "Dolphin");
    assert_eq!(cert.issued_at_ms, NOW_MS);
    assert_eq!(cert.issued_wat, "11 November 2026, 09:42 WAT");
    assert_eq!(cert.issued_iso, "2026-11-11T09:42:13+01:00");
    assert_eq!(cert.serial, "GD-RN02-9BHY");
    assert_eq!(cert.cert_id, "eyJ2IjoyfQ");
    assert_eq!(cert.minted_at_ms, NOW_MS + 1000);
    let m = &t.metadata;
    assert_eq!(m.media.as_deref(), Some("https://www.grinddistrict.app/cert/eyJ2IjoyfQ/image.png"));
    assert_eq!(m.reference.as_deref(), Some("https://www.grinddistrict.app/cert/eyJ2IjoyfQ/meta.json?chain=near"));
    assert!(m.description.as_deref().unwrap().contains("Not an accredited qualification"));
    let extra: serde_json::Value = serde_json::from_str(m.extra.as_deref().unwrap()).unwrap();
    assert_eq!(extra["issuer"], "Grind District");
    assert_eq!(extra["chain"], "NEAR");
    assert_eq!(extra["attributes"][6]["value"], "2026-11-11T09:42:13+01:00");
    assert!(get_logs().iter().any(|l| l.contains("\"event\":\"nft_mint\"")));
    assert_eq!(c.nft_total_supply().0, 1);
    assert_eq!(c.nft_supply_for_owner(acc("amina.testnet")).0, 1);
    assert_eq!(c.cert_for("amina".into(), "spot".into()).unwrap().token_id, "1");
    assert_eq!(c.nft_metadata().symbol, "GDCERT");
}

#[test]
#[should_panic(expected = "already minted as token 1")]
fn one_per_player_and_course() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    ctx("amina.testnet", storage(), NOW_MS);
    c.nft_mint(v.clone(), sign(&key(), &v));
    let v2 = voucher("other.testnet", "spot", "Amina Bello");
    ctx("other.testnet", storage(), NOW_MS);
    c.nft_mint(v2.clone(), sign(&key(), &v2));
}

#[test]
#[should_panic(expected = "bad voucher signature")]
fn rejects_tampered_voucher() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    let sig = sign(&key(), &v);
    ctx("amina.testnet", storage(), NOW_MS);
    c.nft_mint(v.replace("Amina Bello", "Someone Else"), sig);
}

#[test]
#[should_panic(expected = "bad voucher signature")]
fn rejects_wrong_signer() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    ctx("amina.testnet", storage(), NOW_MS);
    c.nft_mint(v.clone(), sign(&SigningKey::from_bytes(&[9u8; 32]), &v));
}

#[test]
#[should_panic(expected = "voucher is for another account")]
fn rejects_other_caller() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    ctx("thief.testnet", storage(), NOW_MS);
    c.nft_mint(v.clone(), sign(&key(), &v));
}

#[test]
#[should_panic(expected = "voucher expired")]
fn rejects_expired() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    ctx("amina.testnet", storage(), NOW_MS + 1_800_001);
    c.nft_mint(v.clone(), sign(&key(), &v));
}

#[test]
#[should_panic(expected = "attach at least")]
fn requires_storage_deposit() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    ctx("amina.testnet", NearToken::from_yoctonear(0), NOW_MS);
    c.nft_mint(v.clone(), sign(&key(), &v));
}

#[test]
#[should_panic(expected = "bad field")]
fn rejects_json_breaking_fields() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina \\\"x\\\"");
    ctx("amina.testnet", storage(), NOW_MS);
    c.nft_mint(v.clone(), sign(&key(), &v));
}

#[test]
#[should_panic(expected = "Soulbound")]
fn cannot_transfer() {
    let mut c = setup();
    let v = voucher("amina.testnet", "spot", "Amina Bello");
    ctx("amina.testnet", storage(), NOW_MS);
    c.nft_mint(v.clone(), sign(&key(), &v));
    ctx("amina.testnet", NearToken::from_yoctonear(1), NOW_MS);
    c.nft_transfer(acc("bob.testnet"), "1".into(), None, None);
}

#[test]
#[should_panic(expected = "owner only")]
fn signer_rotation_owner_only() {
    let mut c = setup();
    ctx("amina.testnet", NearToken::from_yoctonear(0), NOW_MS);
    c.set_signer(pk(&SigningKey::from_bytes(&[9u8; 32])));
}

#[test]
fn iso_wat_handles_leap_day_and_midnight() {
    assert_eq!(iso_wat(951_782_400_000), "2000-02-29T01:00:00+01:00");
    assert_eq!(iso_wat(1_794_439_800_000), "2026-11-12T00:30:00+01:00");
}
