// Grind District's Base Builder Code (ERC-8021), bc_ke1fy1yi, as the suffix appended to the calldata of Base
// transactions the game itself builds (today: the certificate mint from the game wallet), so Base attributes
// that activity to the app. Contracts decode their arguments normally and ignore trailing calldata.
// tests/cert.check.ts checks this equals Attribution.toDataSuffix({ codes: ['bc_ke1fy1yi'] }) from ox.
export const BUILDER_CODE = 'bc_ke1fy1yi'
export const BUILDER_SUFFIX = '62635f6b653166793179690b0080218021802180218021802180218021'
export const withBuilderCode = (data: `0x${string}`): `0x${string}` => `${data}${BUILDER_SUFFIX}`
