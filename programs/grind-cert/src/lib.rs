//! Grind District certificate program (Solana, native Rust).
//!
//! A certificate is a program-owned account (PDA) that only the Grind District issuer key can create, after the
//! game server has checked a passed, server-graded exam. There is no transfer instruction, so a certificate is
//! soulbound: it stays bound to the player it was issued to. Accounts hold no tokens and no money value.
//!
//! Accounts
//!   Config  PDA ["config"]                          issuer, owner (project owner wallet, metadata only), count
//!   Cert    PDA ["cert", player_id, course_seed]    one per (player, course); player_id is a server-derived 32-byte
//!                                                   id (no names or emails on-chain), course_seed = sha256(course id)
//!
//! Instructions (first byte = tag)
//!   0 InitConfig  [issuer(s,w), config(w), system]          data: owner[32]
//!   1 Issue       [issuer(s,w), config(w), cert(w), system] data: player_id[32] course_id[32] cert_hash[32] recipient[32]
//!   2 SetIssuer   [issuer(s), config(w)]                    data: new_issuer[32]
//!   3 Revoke      [issuer(s), config, cert(w)]
//!   4 Close       [issuer(s,w), config, cert(w)]            removes a record (e.g. a self-test) and returns its rent
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    hash::hashv,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction, system_program,
    sysvar::Sysvar,
};

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

pub const CONFIG_SEED: &[u8] = b"config";
pub const CERT_SEED: &[u8] = b"cert";
pub const CONFIG_TAG: u8 = 1;
pub const CERT_TAG: u8 = 2;
/// tag, bump, issuer, owner, count
pub const CONFIG_LEN: usize = 1 + 1 + 32 + 32 + 8;
/// tag, bump, revoked, player_id, course_id, cert_hash, serial, issued_at, issuer, recipient
pub const CERT_LEN: usize = 1 + 1 + 1 + 32 + 32 + 32 + 8 + 8 + 32 + 32;

#[repr(u32)]
pub enum CertError {
    NotIssuer = 6000,
    AlreadyInitialized = 6001,
    BadAccount = 6002,
    AlreadyIssued = 6003,
}
impl From<CertError> for ProgramError {
    fn from(e: CertError) -> Self { ProgramError::Custom(e as u32) }
}

pub fn course_seed(course_id: &[u8; 32]) -> [u8; 32] { hashv(&[course_id]).to_bytes() }

pub fn config_address(program_id: &Pubkey) -> (Pubkey, u8) { Pubkey::find_program_address(&[CONFIG_SEED], program_id) }

pub fn cert_address(program_id: &Pubkey, player_id: &[u8; 32], course_id: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CERT_SEED, player_id, &course_seed(course_id)], program_id)
}

fn arr32(d: &[u8], at: usize) -> Result<[u8; 32], ProgramError> {
    d.get(at..at + 32).and_then(|s| s.try_into().ok()).ok_or(ProgramError::InvalidInstructionData)
}

fn create_pda<'a>(payer: &AccountInfo<'a>, acct: &AccountInfo<'a>, sys: &AccountInfo<'a>, program_id: &Pubkey, len: usize, seeds: &[&[u8]]) -> ProgramResult {
    if acct.lamports() > 0 || !acct.data_is_empty() { return Err(CertError::AlreadyIssued.into()) }
    let lamports = Rent::get()?.minimum_balance(len);
    invoke_signed(&system_instruction::create_account(payer.key, acct.key, lamports, len as u64, program_id), &[payer.clone(), acct.clone(), sys.clone()], &[seeds])
}

fn load_config(program_id: &Pubkey, config: &AccountInfo) -> Result<(Pubkey, u8), ProgramError> {
    let (addr, _) = config_address(program_id);
    if *config.key != addr || config.owner != program_id { return Err(CertError::BadAccount.into()) }
    let d = config.try_borrow_data()?;
    if d.len() != CONFIG_LEN || d[0] != CONFIG_TAG { return Err(CertError::BadAccount.into()) }
    Ok((Pubkey::new_from_array(arr32(&d, 2)?), d[1]))
}

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (&tag, rest) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    let it = &mut accounts.iter();
    match tag {
        0 => {
            let issuer = next_account_info(it)?;
            let config = next_account_info(it)?;
            let sys = next_account_info(it)?;
            if !issuer.is_signer { return Err(ProgramError::MissingRequiredSignature) }
            if *sys.key != system_program::ID { return Err(CertError::BadAccount.into()) }
            let owner = arr32(rest, 0)?;
            let (addr, bump) = config_address(program_id);
            if *config.key != addr { return Err(CertError::BadAccount.into()) }
            if !config.data_is_empty() { return Err(CertError::AlreadyInitialized.into()) }
            create_pda(issuer, config, sys, program_id, CONFIG_LEN, &[CONFIG_SEED, &[bump]])?;
            let mut d = config.try_borrow_mut_data()?;
            d[0] = CONFIG_TAG;
            d[1] = bump;
            d[2..34].copy_from_slice(issuer.key.as_ref());
            d[34..66].copy_from_slice(&owner);
            d[66..74].copy_from_slice(&0u64.to_le_bytes());
            msg!("grind-cert: config ready");
            Ok(())
        }
        1 => {
            let issuer = next_account_info(it)?;
            let config = next_account_info(it)?;
            let cert = next_account_info(it)?;
            let sys = next_account_info(it)?;
            if !issuer.is_signer { return Err(ProgramError::MissingRequiredSignature) }
            if *sys.key != system_program::ID { return Err(CertError::BadAccount.into()) }
            let (want, _) = load_config(program_id, config)?;
            if want != *issuer.key { return Err(CertError::NotIssuer.into()) }
            let player_id = arr32(rest, 0)?;
            let course_id = arr32(rest, 32)?;
            let cert_hash = arr32(rest, 64)?;
            let recipient = arr32(rest, 96)?;
            let cs = course_seed(&course_id);
            let (addr, bump) = Pubkey::find_program_address(&[CERT_SEED, &player_id, &cs], program_id);
            if *cert.key != addr { return Err(CertError::BadAccount.into()) }
            create_pda(issuer, cert, sys, program_id, CERT_LEN, &[CERT_SEED, &player_id, &cs, &[bump]])?;
            let serial = {
                let mut c = config.try_borrow_mut_data()?;
                let n = u64::from_le_bytes(c[66..74].try_into().unwrap()).checked_add(1).ok_or(ProgramError::ArithmeticOverflow)?;
                c[66..74].copy_from_slice(&n.to_le_bytes());
                n
            };
            let now = Clock::get()?.unix_timestamp;
            let mut d = cert.try_borrow_mut_data()?;
            d[0] = CERT_TAG;
            d[1] = bump;
            d[2] = 0;
            d[3..35].copy_from_slice(&player_id);
            d[35..67].copy_from_slice(&course_id);
            d[67..99].copy_from_slice(&cert_hash);
            d[99..107].copy_from_slice(&serial.to_le_bytes());
            d[107..115].copy_from_slice(&now.to_le_bytes());
            d[115..147].copy_from_slice(issuer.key.as_ref());
            d[147..179].copy_from_slice(&recipient);
            msg!("grind-cert: issued");
            Ok(())
        }
        2 => {
            let issuer = next_account_info(it)?;
            let config = next_account_info(it)?;
            if !issuer.is_signer { return Err(ProgramError::MissingRequiredSignature) }
            let (want, _) = load_config(program_id, config)?;
            if want != *issuer.key { return Err(CertError::NotIssuer.into()) }
            let new_issuer = arr32(rest, 0)?;
            config.try_borrow_mut_data()?[2..34].copy_from_slice(&new_issuer);
            msg!("grind-cert: issuer rotated");
            Ok(())
        }
        3 => {
            let issuer = next_account_info(it)?;
            let config = next_account_info(it)?;
            let cert = next_account_info(it)?;
            if !issuer.is_signer { return Err(ProgramError::MissingRequiredSignature) }
            let (want, _) = load_config(program_id, config)?;
            if want != *issuer.key { return Err(CertError::NotIssuer.into()) }
            if cert.owner != program_id { return Err(CertError::BadAccount.into()) }
            let mut d = cert.try_borrow_mut_data()?;
            if d.len() != CERT_LEN || d[0] != CERT_TAG { return Err(CertError::BadAccount.into()) }
            d[2] = 1;
            msg!("grind-cert: revoked");
            Ok(())
        }
        4 => {
            let issuer = next_account_info(it)?;
            let config = next_account_info(it)?;
            let cert = next_account_info(it)?;
            if !issuer.is_signer { return Err(ProgramError::MissingRequiredSignature) }
            let (want, _) = load_config(program_id, config)?;
            if want != *issuer.key { return Err(CertError::NotIssuer.into()) }
            if cert.owner != program_id || cert.key == config.key { return Err(CertError::BadAccount.into()) }
            {
                let d = cert.try_borrow_data()?;
                if d.len() != CERT_LEN || d[0] != CERT_TAG { return Err(CertError::BadAccount.into()) }
            }
            let lamports = cert.lamports();
            **issuer.try_borrow_mut_lamports()? = issuer.lamports().checked_add(lamports).ok_or(ProgramError::ArithmeticOverflow)?;
            **cert.try_borrow_mut_lamports()? = 0;
            cert.resize(0)?;
            cert.assign(&system_program::ID);
            msg!("grind-cert: closed");
            Ok(())
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
