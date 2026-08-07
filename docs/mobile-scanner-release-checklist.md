# Scanner release checklist

- [ ] Preview build is green.
- [ ] Expo mobile TypeScript build is green.
- [ ] Scanner can only be opened with a selected event.
- [ ] Wrong-event ticket is rejected without mutation.
- [ ] Outside-window scan is rejected without mutation.
- [ ] Valid scan increments checked-in count.
- [ ] Duplicate scan does not increment checked-in count.
- [ ] Event cards show checked-in / sold attendance progress.
- [ ] Blank poster URLs render fallback artwork.
- [ ] Production database migration path for dedicated check-in times is confirmed before adding persistent fields.
- [ ] Device test completed on iOS and Android before merging to the release branch.
