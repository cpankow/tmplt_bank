Template bank / Overlap visualizer

Use Instructions

1. Generate overlaps
    - Run `rapidpe_calculate_overlap` to generate:
        - tmplt_bank.json: Serves as a 'table of contents' and lookup table for the visualizer
        - bank.json: Describes the template bank in general
        - 'type'/'type'_index.json: Describes the overlaps for each indexed template
2. Copy `tmplt_bank.js` to web directory
    - Additional javascript required:
        - d3js.js (latest version available here: )
        - jquery-*.js (latest version available here: )
        - colorbar.js (included as a git submodule)
    - Copy or include these in the file

See example file `index.html` in `examples/`
