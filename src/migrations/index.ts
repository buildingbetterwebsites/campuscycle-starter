import * as migration_20260928_082604_initial from './20260928_082604_initial';
import * as migration_20260928_151841_content_model from './20260928_151841_content_model';
import * as migration_20261004_165222_site_facts from './20261004_165222_site_facts';
import * as migration_20261004_173034_latest_end from './20261004_173034_latest_end';
import * as migration_20261004_205526_booking_request_id from './20261004_205526_booking_request_id';
import * as migration_20261004_222941_members_area from './20261004_222941_members_area';

export const migrations = [
  {
    up: migration_20260928_082604_initial.up,
    down: migration_20260928_082604_initial.down,
    name: '20260928_082604_initial',
  },
  {
    up: migration_20260928_151841_content_model.up,
    down: migration_20260928_151841_content_model.down,
    name: '20260928_151841_content_model',
  },
  {
    up: migration_20261004_165222_site_facts.up,
    down: migration_20261004_165222_site_facts.down,
    name: '20261004_165222_site_facts',
  },
  {
    up: migration_20261004_173034_latest_end.up,
    down: migration_20261004_173034_latest_end.down,
    name: '20261004_173034_latest_end',
  },
  {
    up: migration_20261004_205526_booking_request_id.up,
    down: migration_20261004_205526_booking_request_id.down,
    name: '20261004_205526_booking_request_id',
  },
  {
    up: migration_20261004_222941_members_area.up,
    down: migration_20261004_222941_members_area.down,
    name: '20261004_222941_members_area'
  },
];
