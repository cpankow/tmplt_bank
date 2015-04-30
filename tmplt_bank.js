/* Copyright 2015 Chris Pankow, see LICENSE for licensing, except where licenses from other copied code might apply */

/* Configuration object */
CONFIG = {
	// SNR colors: need a color for each value in snr_range
	"snr_colors": ["blue", "red"]
};
console.log(CONFIG);

IDX_MAP = {
    "mass1": 0,
    "mass2": 1,
    "spin1z": 2,
    "spin2z": 3,
    // FIXME: These do an in-place replament, so the user has to switch back to
    // physical masses before doing a different system
    "mchirp": 0,
    "eta": 1,
    "tau0": 0,
    "tau3": 1
};

COORD_SYS = ["mass1_mass2", "mchirp_eta", "tau0_tau3", "spin1z_spin2z", "mass1_spin1z", "mass2_spin2z"];
COORD_SYS_IDX = 0;

/*
 * Utility and metric conversion functions
 * FIXME: Get the index *once*
 */

/*
 * Convert component physical masses to chirp mass and symmetric mass ratio
 */
function mc_eta(data) {
    var i1 = IDX_MAP["mass1"];
    var i2 = IDX_MAP["mass2"];
    var j1 = IDX_MAP["mchirp"];
    var j2 = IDX_MAP["eta"];
    for (i = 0; i < data.length; i++) {
        var m1 = data[i][i1];
        var m2 = data[i][i2];
        data[i][j1] = Math.pow(m1*m2, 3./5.) * Math.pow(m1+m2, -1./5.);
        data[i][j2] = m1*m2/(m1+m2)/(m1+m2);
    }
    return data;
}

/*
 * Convert physical compoent masses to "tau0 tau3" components. See 
 * T. Cokelaer Phys. Rev. D 76, 102004
 */
__prefac_0 = 5. / 256 / Math.PI;
__prefac_3 = 1. / 8 / Math.PI;
function tau0_tau3(data, flow) {

    // FIXME: Address the low frequency of the template
    if (typeof(flow)==='undefined') flow = 40;

    var i1 = IDX_MAP["mass1"];
    var i2 = IDX_MAP["mass2"];
    var j1 = IDX_MAP["tau0"];
    var j2 = IDX_MAP["tau3"];

    for (i = 0; i < data.length; i++) {
        var m1 = data[i][i1];
        var m2 = data[i][i2];
        var mt = m1 + m2;
        var eta = m1 * m2 / mt / mt;
        mt *= Math.PI * flow;
        data[i][j1] = __prefac_0 / flow / eta * Math.pow(mt, (-5./3));
        data[i][j2] = __prefac_3 / flow / eta * Math.pow(mt, (-2./3));
    }
    return data;
}

/*
 * Convert chirp mass and symmetric mass ratio to component physical masses
 */
function m1m2(data) {
    var i1 = IDX_MAP["mchirp"];
    var i2 = IDX_MAP["eta"];
    var j1 = IDX_MAP["mass1"];
    var j2 = IDX_MAP["mass2"];
    for (i = 0; i < data.length; i++) {
        mc = data[i][i1];
        eta = data[i][i2];
        data[i][j1] = 0.5*mc*Math.pow(eta, -3./5.)*(1. + Math.sqrt(1 - 4.*eta));
        data[i][j2] = 0.5*mc*Math.pow(eta, -3./5.)*(1. - Math.sqrt(1 - 4.*eta));
    }
    return data;
}

/*
 * Convert "tau0 tau3" components to physical compoent masses. See 
 * T. Cokelaer Phys. Rev. D 76, 102004
 */
__prefac_tau = 5. / 32 / Math.PI;
function tau0_tau3_inv(data, flow) {
    // FIXME: Address the low frequency of the template
    if (typeof(flow)==='undefined') flow = 40;

    var i1 = IDX_MAP["tau0"];
    var i2 = IDX_MAP["tau3"];
    var j1 = IDX_MAP["mass1"];
    var j2 = IDX_MAP["mass2"];

    for (i = 0; i < data.length; i++) {
        // FIXME: This is implcitly mc/eta
        var tau0 = data[i][i1];
        var tau3 = data[i][i2];
        data[i][j1] =  __prefac_tau / flow / Math.PI * tau3 / tau0;
        data[i][j2] = 1.0 / 8 / flow / tau3 * Math.pow(__prefac_tau * tau0 / tau3, 2./3);
        // FIXME: make this a one-step transform
        data = m1m2(data);
    }
    return data;
}

/*
 * Construct an SVG scatter plot given:
 * data: data array with each element having mass1/mass2/overlap information
 * main: main plotting area (SVG)
 * x: D3js axis1 scale
 * y: D3js axis2 scale
 * c: D3js overlap scale (colorscale)
 * sidebar: reference to sidebar object -- needed for mouse event binding
 * full_bank: array of m1, m2 pairs arranged by index in the template bank
 */
function scatter_plot(data, main, x, y, c, sidebar, full_bank) {

	var g = main.append("svg:g")
			.attr("class", "scatter-dots");

    // Map the overlap data by index
    var data_map = {};
    var tmplt_idx_pos = data[0].length-1;
    var ovrlp_idx_pos = data[0].length-2;
    for (i = 0; i < data.length; i++) {
        data_map[data[i][tmplt_idx_pos]] = data[i][ovrlp_idx_pos];
    }

    var mean_ovrlp = d3.mean(data, function(d) { return d[ovrlp_idx_pos]; });
    var n_html = "Mean overlap: " + mean_ovrlp;

    // List the nearest neighbors
    data = data.sort(function(d1, d2) {
        return d1[ovrlp_idx_pos] < d2[ovrlp_idx_pos] ? 1 : -1;
    });
    var n_neighbors = 11;
    n_html += "<br><h3>Neighbors</h3>";
    for (i = 1; i < n_neighbors; i++) {
        d = data[i];
        n_html += "<br>";
        n_html += d[0] + " " + d[1] + " " + d[ovrlp_idx_pos];
    }

    // If it exists, get it
    var nghbr = sidebar.select(".neighbors");
    // else make it
    if (nghbr.empty()) {
        nghbr = sidebar.append("div")
                .attr("class", "neighbors")
                .style("padding-top", "10px");
    }
    nghbr.html(n_html);

    // FIXME: Split into calculated and uncalculated dots
    // This is so the 'uncalculated' dots don't overlay on top
	dots = g.selectAll("scatter-dots")
		.data(full_bank)
		.enter().append("svg:circle")
		.attr("cx", function (d) { return x(d); } )
		.attr("cy", function (d) { return y(d); } )
		.attr("r", 3)
        .attr("fill", function(d, i) { 
            if (data_map[i]) {
                return c(data_map[i]); 
            }
        })
        // Ensure the uncalculated points are below the colored ones
        .attr("zorder", function(d, i) {
            if (data_map[i]) {
                return 1;
            } else {
                return 0;
            }
        });

    // FIXME: This won't work if there are multiple scatter plots on a page.
    var idx_select = d3.select(".idx_selector");
    idx_select.on("change", function() {
        idx = this.selectedIndex;
        console.log("Getting data for index " + idx);
        //console.log("Loading " + full_bank[idx][d.length-1]);
        new_dat = full_bank[idx]

        // Load new overlaps
        // FIXME: Should update instead
        d3.json(new_dat[new_dat.length-1], function(error, data) {
            if (error) {
                sidebar.select(".info").html(error.responseText);
                return;
            }
            console.log("...loaded.");
            dots.remove();
            // Draw some dots!
            data = data["overlap"];
            scatter_plot(data, main, x, y, c, sidebar, full_bank);
            sidebar.select(".info").html("mass1: " + new_dat[0] + "<br>mass2: " + new_dat[1] + "<br> index " + idx);
        });
    });

    // FIXME: Move this to each type construction and select on it
    var ttip = d3.select(".tooltip");

    // Give a tooltip with some basic info if hovered over
    dots.on("mouseover", function(d, i) {
        overlap_val = 'N/A'
        if (data_map[i]) {
            overlap_val = data_map[i]; 
        }
        ttip.transition()
            .duration(200) 
            .style("opacity", 0.9);      
        ttip.html("masses: (" + d[0] + ", " + d[1] + ")" + "<br/>overlap: " + overlap_val)  
            .style("left", (d3.event.pageX) + "px")     
            .style("top", (d3.event.pageY - 28) + "px");
    });

    // And make it go away
    dots.on("mouseout", function(d, i) {
        ttip.transition()
            .duration(500)
            .style("opacity", 0);
    });

    // Load a new overlap mapping if a user clicks on a point
    dots.on("mouseup", function(d, i) {
        sidebar.transition()
        .duration(200)
        .style("opacity", 1.0);

        console.log("Loading " + d[d.length-1]);
        // Load new overlaps
        // FIXME: Should update instead
        d3.json(d[d.length-1], function(error, data) {
            if (error) {
                sidebar.select(".info").html(error.responseText);
                return;
            }
            console.log("...loaded.");
            dots.remove();
            // Draw some dots!
            data = data["overlap"];
            scatter_plot(data, main, x, y, c, sidebar, full_bank);
            sidebar.select(".info").html("mass1: " + d[0] + "<br>mass2: " + d[1] + "<br> index " + i);
        });
        // Also change the index selector
        idx_select.node().options[i].selected = true;
    });
}

/*
 * Construct the round specific sub header with round indication and some
 * information about the results of the round
 * FIXME: Make more verbose
 */
function construct_subheader(name, shead_obj) {
	shead_obj.append("div")
		.attr("class", "type_name")
		.style("font-size", "36pt")
		.html("Type " + name);
}

/*
 * load_data is called for each round to create the data plotting area and
 * set up the auto wscan sidebar
 * FIXME: Static style should be moved to a CSS file
 */
function load_data(type, container, full_bank, axis1, axis2) {

    a1_idx = IDX_MAP[axis1];
    a2_idx = IDX_MAP[axis2];
    console.log("Mapped " + axis1 + " to data index " + a1_idx);
    console.log("Mapped " + axis2 + " to data index " + a2_idx);

	// Add some margins to the plotting area
	var margin = {top: 20, right: 15, bottom: 60, left: 60}
		, width = 960 - margin.left - margin.right
		, height = 500 - margin.top - margin.bottom;

    // Main scales
    // FIXME: Use .extent?
    min_mass1 = 0.9 * d3.min(full_bank, function(d){ return d[a1_idx]; });
    max_mass1 = 1.1 * d3.max(full_bank, function(d){ return d[a1_idx]; });
    min_mass2 = 0.9 * d3.min(full_bank, function(d){ return d[a2_idx]; });
    max_mass2 = 1.1 * d3.max(full_bank, function(d){ return d[a2_idx]; });
    if (min_mass1 == max_mass1) {
        min_mass1 = -1;
        max_mass1 = 1;
    }
    if (min_mass2 == max_mass2) {
        min_mass2 = -1;
        max_mass2 = 1;
    }
    console.log("Loaded template bank with min/max axis1: " + min_mass1 + " " + max_mass1 + " and min/max axis2: " + min_mass2 + " " + max_mass2);

	// This is the main plot canvas
    var chart = container.select(".chart");
	var main = chart.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
		.attr('width', width)
		.attr('height', height)
		.attr('float', 'left')
		.attr('class', 'canvas');

	// mass1 scaling
	var x = d3.scale.linear()
        .domain([ min_mass1, max_mass1 ])
		.range([ 0, width ]);

	// mass2 scaling
	var y = d3.scale.linear()
        .domain([ min_mass2, max_mass2 ])
		.range([ height, 0 ]);

	// SNR colorbar scaling
	var c = d3.scale.linear()
		.domain([0, 1])
		.range(CONFIG.snr_colors);

	// draw the x axis
	var xAxis = d3.svg.axis()
		.scale(x)
		.orient('bottom')
		.tickSize(-height);

	main.append('g')
		.attr('transform', 'translate(0,' + height + ')')
		.attr('class', 'main axis date xaxis')
		.call(xAxis);

	// x-axis label
	chart.append('g').append("text")
		.attr("class", "x_label")
		.attr("text-anchor", "end")
		.attr("x", width/2)
		.attr("y", height + margin.top + margin.bottom / 2)
		.text(axis1);

	// draw the y axis
	var yAxis = d3.svg.axis()
		.scale(y)
		.orient('left')
		.tickSize(-width);

	main.append('g')
		.attr('transform', 'translate(0,0)')
		.attr('class', 'main axis date yaxis')
		.call(yAxis);

	// x-axis label
	chart.append('g').append("text")
		.attr("class", "y_label")
		.attr("text-anchor", "end")
		// rotate needs the point around which to rotate, hence the position of the
		// object is given here
		.attr("transform", "rotate(270," + 10 + "," + height/2  + ")")
		.attr("x", 10)
		.attr("y", height/2)
		.text(axis2);

    // We encapsulate these here so that the scatter plot constructor doesn't
    // need additional information about the relative index in the data array
    var get_x = function (d) {
        return x(d[a1_idx]);
    }

    var get_y = function (d) {
        return y(d[a2_idx]);
    }

    // Do things like zooming and such
    var zoom = d3.behavior.zoom()
        .x(x)
        .y(y)
        .scaleExtent([0.5, 500])
        .on("zoom", zoomed);

    function zoomed() {
        chart.select(".xaxis").call(xAxis);
        chart.select(".yaxis").call(yAxis);
        chart.selectAll("circle")
            .attr("cx", function(d) {
                return get_x(d);
            })
            .attr("cy", function(d) {
                return get_y(d);
            })
    }
    chart.call(zoom);

	// draw color axis
	var cAxis = Colorbar()
		.scale(c)
		.origin([0, 0])
		.thickness(10)
		.barlength(400)
		.title("overlap")
		.orient("vertical");
    cAxis.margin.bottom = 400;

	cbarsvg = container.append("svg")
        .attr("class", "colorbar")
        .style("float", "left")
        .style("height", height + margin.bottom)
	cbarsvg.append('g')
        .attr('transform', 'translate(50,20)')
        .call(cAxis);
	// colorbar label
	cbarsvg.append('g').append("text")
		.attr("class", "c_label")
		.attr("text-anchor", "end")
		.attr("transform", "rotate(90," + 10 + "," + 50  + ")")
		.attr("x", 25)
		.attr("y", 50)
		.text("overlap");

    var sidebar = container.select(".sidebar");
    d3.json(type["filename"], function(error, data) {
        // Draw some dots!
        mass1 = data["mass1"];
        mass2 = data["mass2"];
        data = data["overlap"];
        //scatter_plot(data, main, x, y, c, sidebar, full_bank);
        scatter_plot(data, main, get_x, get_y, c, sidebar, full_bank);
    });
}

// Header contains succint round information
// FIXME: More style!
header = d3.select("body").append("div")
	.attr("class", "round_header")
	.style("width", "100%")
	.style("clear", "left")

// FIXME: No, seriously... wut?
// This probably means the bank *has* ot be loaded first --- is there a way
// to synchronize this?
d3.json("bank.json", function(error, full_bank) {
    /*
     * tmplt_bank.json is where the type information is expected to be stored --
     * without it, none of this works. The overlap file information is inferred by
     * the information stored in this file, so it must be accurate and complete
     */
    d3.json("tmplt_bank.json", function(data) {
        header.append("h2").html("Table of Overlap Calculations");
        // Create an entry for this round in the header
        header.selectAll("p")
            .data(Object.keys(data["types"]))
            .enter().append("p")
            .html(function(k) {
                return "<a href='#type_" + k + "'>Type " + k + "</a>";
            });

        header.append("p").html("<br/>The following plots show the overlap of a given template bank for a given selected template with each other template in the bank. The 'type' often indicates the waveform family used to do the overlap, and can be different.");
        header.append("p").html("<br/><b>Instructions</b>: Click on any point to load overlap with template bank. Scroll to zoom, click and drag to pan. Hover on a point to get more information.");

        // Loop through the rounds and create a scatter plot section for each
        types = Object.keys(data["types"]);
        console.log("Loaded these types: " + types);
        // Dear javascript... learn how to iterate through a dict properly like
        // python. This code is unnecessarily complicated, and you should feel bad
        for (var i = 0; i < types.length; i++) {
            var type = types[i];
            var init_data = data["types"][type][0];

            // Create the hovering tooltip
            var ttip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            // Scatter and left sidebar container
            var container = d3.select("body").append("div")
                .attr("class", "container")
                .style("float", "left");

            var sub_header = container.append("div")
                .attr("class", "sub_header")
                .style("width", "100%")
                .style("text-align", "right")
                .style("border-top-width", "2px")
                .style("border-top-style", "solid");
            // Add an anchor point for links from the top table
            sub_header.html("<a name='type_" + name + "'></a>")
            construct_subheader(type, sub_header);

            // This is the left sidebar where event information and wscans appear
            // FIXME: Move this to config?
            var sidebar_size = 300;
            var sidebar = container.append("div")
                .attr("class", "sidebar")
                .style("position", "absolute")
                .style("left", 0)
                .style("width", sidebar_size + "px")
                .style("padding", "10px");

            // Add some margins to the plotting area
            // FIXME: Don't replicate this here and load_data -- make config?
            var margin = {top: 20, right: 15, bottom: 60, left: 60}
                , width = 960 - margin.left - margin.right
                , height = 500 - margin.top - margin.bottom;

            var chart = container.append('div')
                    .attr("class", "scatterplot")
                    .style("padding-left", sidebar_size + "px")
                    .style("float", "left")
                    .style("clear", "both")
                .append('svg:svg')
                    .attr('width', width + margin.right + margin.left)
                    .attr('height', height + margin.top + margin.bottom)
                    .attr('class', 'chart');

            // Index selector
            var idx_select = sidebar.append("select")
                .attr("class", "idx_selector");
            idx_select.selectAll("option").data(full_bank)
                .enter().append("option")
                .text(function(d, i) {
                    return "(" + i + ")" + " " + d.slice(0, -1);
                });

            // Coordinate selector
            var coord_select = sidebar.append("select");
            coord_select.on("change", function() {
                sys = this.options[this.selectedIndex];
                console.log(sys.value);
                
                // Transform data
                // WARNING: This is *in place*, don't lose track of your
                // coordinate system
                // FIXME: This should update the data via a transformation
                chart.selectAll("*").remove();
                container.selectAll(".colorbar").remove();
                axis1 = undefined;
                axis2 = undefined;
                switch (sys.value) {
                    case "mass1_mass2": 
                        axis1 = "mass1";
                        axis2 = "mass2";
                        console.log("Transforming to mass1 / mass2 space");
                        if (COORD_SYS[COORD_SYS_IDX] == "mchirp_eta") {
                            full_bank = m1m2(full_bank);
                        } else if (COORD_SYS[COORD_SYS_IDX] == "tau0_tau3") {
                            full_bank = tau0_tau3_inv(full_bank);
                        }
                        COORD_SYS_IDX = COORD_SYS.indexOf("mass1_mass2");
                        break;
                    case "mchirp_eta": 
                        axis1 = "mchirp";
                        axis2 = "eta";
                        console.log("Transforming to mchirp / eta space");
                        full_bank = mc_eta(full_bank);
                        COORD_SYS_IDX = COORD_SYS.indexOf("mchirp_eta");
                        break;
                    case "tau0_tau3": 
                        axis1 = "tau0";
                        axis2 = "tau3";
                        console.log("Transforming to tau0 / tau3 space");
                        full_bank = tau0_tau3(full_bank);
                        COORD_SYS_IDX = COORD_SYS.indexOf("tau0_tau3");
                        break;
                    case "spin1z_spin2z": 
                        axis1 = "spin1z";
                        axis2 = "spin2z";
                        console.log("Transforming to spin1z / spin2z space");
                        COORD_SYS_IDX = COORD_SYS.indexOf("spin1z_spin2z");
                        break;
                    case "mass1_spin1z": 
                        axis1 = "mass1";
                        axis2 = "spin1z";
                        console.log("Transforming to mass1 / spin1z space");
                        COORD_SYS_IDX = COORD_SYS.indexOf("mass1_spin1z");
                        break;
                    case "mass2_spin2z": 
                        axis1 = "mass2";
                        axis2 = "spin2z";
                        console.log("Transforming to mass2 / spin2z space");
                        COORD_SYS_IDX = COORD_SYS.indexOf("mass2_spin2z");
                        break;
                }
                load_data(init_data, container, full_bank, axis1, axis2);

            });
            coord_select.selectAll("option").data(COORD_SYS)
                .enter().append("option")
                .text(function(d) {
                    return d;
                });

            sidebar.append("div")
                .attr("class", "info")
                .style("padding", "10px")
                .html("mass1: " + init_data.mass1 + "<br>mass2: " + init_data.mass2 + "<br> index " + 0);

            // FIXME: We get the first one, arbitrarily.
            load_data(init_data, container, full_bank, "mass1", "mass2");
        }

    });
});
