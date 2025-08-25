use std::hash::poseidon2;

global MAX_STRING_LENGTH: u32 = 21; // max length for string claim

fn main(
    msg_hash: [u8; 32],       // Hashed message (e.g., keccak256(nonce))
    signature: [u8; 64],      // r and s concatenated
    pub_key_x: [u8; 32],      // Public key coordinates
    election_id: pub Field
) -> pub Field {


    // Verify that the signature is valid 

    // nullifier generation
    let mut hashInput: [Field; MAX_STRING_LENGTH+1] = [election_id; MAX_STRING_LENGTH+1];
    for i in 0..MAX_STRING_LENGTH { hashInput[i] =  sub.storage()[i] as Field; }

    let nullifier = poseidon2::Poseidon2::hash(hashInput, MAX_STRING_LENGTH+1);
    nullifier
}
