# Filter lists fixture

A small copy of the `lists/` layout. `scripts/lists/build.test.ts` checks that it compiles to `../filter-lists.bin`, which the filter module's Kotlin tests read, so both sides agree on the format.

Regenerate the compiled file after a change:

    node scripts/build-lists.ts --lists test/fixtures/filter-lists --out test/fixtures/filter-lists.bin
