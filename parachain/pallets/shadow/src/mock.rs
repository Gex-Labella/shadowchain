//! Test environment for Shadow pallet

use crate as pallet_shadow;
use sp_runtime::BuildStorage;
use frame::{
	deps::{frame_support::weights::IdentityFee, frame_system as system, sp_core::ConstU32},
	runtime::prelude::*,
	traits::VariantCount,
};

// Configure a mock runtime to test the pallet.
#[frame_support::runtime]
mod test_runtime {
	#[runtime::runtime]
	#[runtime::derive(
		RuntimeCall,
		RuntimeEvent,
		RuntimeError,
		RuntimeOrigin,
		RuntimeFreezeReason,
		RuntimeHoldReason,
		RuntimeSlashReason,
		RuntimeLockId,
		RuntimeTask
	)]
	pub struct Test;

	#[runtime::pallet_index(0)]
	pub type System = frame_system;
	
	#[runtime::pallet_index(1)]
	pub type Balances = pallet_balances;
	
	#[runtime::pallet_index(2)]
	pub type Shadow = pallet_shadow;
}

parameter_types! {
	pub const BlockHashCount: u64 = 250;
}

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type Block = Block<Self>;
	type AccountData = pallet_balances::AccountData<u64>;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
	type AccountStore = System;
}

parameter_types! {
	pub const MaxItemsPerAccount: u32 = 100;
	pub const MaxCidLength: u32 = 100;
	pub const MaxKeyLength: u32 = 512;
	pub const MaxMetadataLength: u32 = 256;
	pub const MaxMessageHashLength: u32 = 64;
}

impl pallet_shadow::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type WeightInfo = ();
	type MaxItemsPerAccount = MaxItemsPerAccount;
	type MaxCidLength = MaxCidLength;
	type MaxKeyLength = MaxKeyLength;
	type MaxMetadataLength = MaxMetadataLength;
	type MaxMessageHashLength = MaxMessageHashLength;
}

// Build genesis storage according to the mock runtime.
pub fn new_test_ext() -> sp_io::TestExternalities {
	let t = system::GenesisConfig::<Test>::default().build_storage().unwrap();
	let mut ext = sp_io::TestExternalities::new(t);
	ext.execute_with(|| System::set_block_number(1));
	ext
}