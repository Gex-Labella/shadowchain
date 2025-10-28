//! Test environment for Shadow pallet.

use crate as pallet_shadow;
use polkadot_sdk::{polkadot_sdk_frame as frame, *};
use frame::{deps::frame_support::derive_impl, runtime::prelude::*};

type Block = frame_system::mocking::MockBlock<Test>;

// Configure a mock runtime to test the pallet.
#[frame_construct_runtime]
mod runtime {
	#[runtime::runtime]
	pub struct Test;

	#[runtime::pallet_index(0)]
	pub type System = frame_system::Pallet<Test>;
	
	#[runtime::pallet_index(1)]
	pub type ShadowPallet = pallet_shadow::Pallet<Test>;
}

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type Block = Block;
}

impl pallet_shadow::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type WeightInfo = ();
}

// Build genesis storage according to the mock runtime.
pub fn new_test_ext() -> sp_io::TestExternalities {
	let t = RuntimeGenesisConfig {
		system: Default::default(),
	}
	.build_storage()
	.unwrap();
	
	let mut ext = sp_io::TestExternalities::new(t);
	ext.execute_with(|| System::set_block_number(1));
	ext
}