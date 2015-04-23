/* Copyright 2015 Chris Pankow, all rights reserved, except where licenses from other copied code might apply */

/* Configuration object */
CONFIG = {
	// SNR colors: need a color for each value in snr_range
	"snr_colors": ["blue", "red"]
};
console.log(CONFIG);

/*
 * Construct the sidebar markup for a given round with winnning channel win_chan
 * reference channel ref_chan and the data point (winner) d.
 * FIXME: This is going away likely because it depends on hardcoded wscan
 * locations
 */
function inner_box(d, win_chan, ref_chan) {
	var htmlstr = "GPS Time: " + d.time + "<br/>Freq.: " + d.frequency + "<br/>SNR: " + d.snr; 
	ref_src = build_srclink(d, ref_chan);
	targ_src = build_srclink(d, win_chan);
	htmlstr += "<br/><b>" + ref_chan + ":</b> <br/> <a href='" + ref_src + "' target='_blank'><img src='" + ref_src + "' width='200px' height='120px' /></a> <br/>";
	htmlstr += "<br/><b>" + win_chan + ":</b> <br/> <a href='" + targ_src + "' target='_blank'><img src='" + targ_src + "' width='200px' height='120px' /></a> <br/>";
	return htmlstr;
}

/*
 * Construct an SVG scatter plot given:
 * data: data array with each element having time/frequency/SNR information
 * x: D3js time scale
 * y: D3js frequency scale
 * c: D3js SNR scale (colorscale)
 * sidebar:reference to sidebar object -- needed for mouse event binding
 * type: 'reference' or 'winner': controls how the sidebar reacts to a given
 * eventt
 */
function scatter_plot(data, main, x, y, c, sidebar, full_bank) {

	var g = main.append("svg:g")
			.attr("class", "scatter-dots");

    // Map the overlap data by index
    var data_map = {};
    for (i = 0; i < data.length; i++) {
        data_map[data[i][3]] = [data[i][0], data[i][1], data[i][2]];
    }

    // FIXME: Split into calculated and uncalculated dots
	dots = g.selectAll("scatter-dots")
		.data(full_bank)
		.enter().append("svg:circle")
		.attr("cx", function (d) { return x(d[0]); } )
		.attr("cy", function (d) { return y(d[1]); } )
		.attr("r", 3)
        .attr("fill", function(d, i) { 
            if (data_map[i]) {
                return c(data_map[i][2]); 
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

    dots.on("mouseup", function(d, i) {
        sidebar.transition()
        .duration(200)
        .style("opacity", 1.0);

        console.log("Loading " + "TaylorF2_TaylorF2/TaylorF2_TaylorF2_" + i + ".json");
        // Load new overlaps
        // FIXME: Should update instead
        d3.json("TaylorF2_TaylorF2/TaylorF2_TaylorF2_" + i + ".json", function(error, data) {
            if (error) {
                sidebar.html(error.responseText);
                return;
            }
            console.log("...loaded.");
            dots.remove();
            // Draw some dots!
            data = data["overlap"];
            scatter_plot(data, main, x, y, c, sidebar, full_bank);
            sidebar.html("mass1: " + d[0] + "<br>mass2: " + d[1] + "<br> index " + i);
        });
    });
}

/*
 * Retrieve a link to the channel description page on CIS.
 * FIXME: Need to figure out how to link by channel name
 * OR get the JSON for that request and parse it manually (ugh)
 */
function construct_cis_link(channel) {
	//return "https://cis.ligo.org/channel/"
	return channel;
}

/*
 * Construct the round specific sub header with round indication and some
 * information about the results of the round
 * FIXME: Make more verbose
 */
function construct_subheader(name, shead_obj) {
	shead_obj.append("div")
		.attr("class", "round_name")
		.style("font-size", "36pt")
		.html("Type " + name);
}

/*
 * load_data is called for each round to create the data plotting area and
 * set up the auto wscan sidebar
 * FIXME: Static style should be moved to a CSS file
 */
function load_data(type, name) {
    
    mass1 = type["mass1"]
    mass2 = type["mass2"]

	// Add some margins to the plotting area
	var margin = {top: 20, right: 15, bottom: 60, left: 60}
		, width = 960 - margin.left - margin.right
		, height = 500 - margin.top - margin.bottom;
			
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
	construct_subheader(name, sub_header);

	// This is the left sidebar where event information and wscans appear
	var sidebar = container.append("div")
		.attr("class", "sidebar")
		.style("position", "absolute")
		.style("left", 0)
		.style("width", "300px")
		.style("padding", "10px")
        .html("Click on any point to load overlap with template bank.");
	 
	// FIXME: Move this to config?
	var sidebar_size = 300;
	var chart = container.append('div')
			.attr("class", "scatterplot")
			.style("padding-left", sidebar_size + "px")
			.style("float", "left")
			.style("clear", "both")
		.append('svg:svg')
			.attr('width', width + margin.right + margin.left)
			.attr('height', height + margin.top + margin.bottom)
			.attr('class', 'chart');

	// This is the main plot canvas
	var main = chart.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
		.attr('width', width)
		.attr('height', height)
		.attr('float', 'left')
		.attr('class', 'canvas');

	// GPS Time scaling
	var x = d3.scale.linear()
		.domain([ 0.9, 3.1 ])
		//.domain([ 2.6, 3.1 ])
		.range([ 0, width ]);

	// Frequency scaling
	var y = d3.scale.linear()
		//.domain([0, d3.max(data, function(d) { return d.frequency; })])
		.domain([ 0.85, 2.1 ])
		//.domain([ 0.9, 1.2 ])
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
		.text("mass 1 (solar masses)");

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
		.text("mass2 (solar masses)");

    // Do things like zooming and such
    var zoom = d3.behavior.zoom()
        .x(x)
        .y(y)
        .scaleExtent([0.5, 100])
        .on("zoom", zoomed);

    function zoomed() {
        chart.select(".xaxis").call(xAxis);
        chart.select(".yaxis").call(yAxis);
        chart.selectAll("circle")
            .attr("cx", function(d) {
                return x(d[0]);
            })
            .attr("cy", function(d) {
                return y(d[1]);
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

	// colorbar label
	cbart = container.append("svg")
        .style("float", "left")
        .style("height", height + margin.bottom)
	cbart.append('g')
        .attr('transform', 'translate(50,20)')
        .call(cAxis);
	cbart.append('g').append("text")
		.attr("class", "c_label")
		.attr("text-anchor", "end")
		.attr("transform", "rotate(90," + 10 + "," + 50  + ")")
		.attr("x", 25)
		.attr("y", 50)
		.text("overlap");

    // FIXME: No, seriously... wut?
    // This probably means the bank *has* ot be loaded first --- is there a way
    // to synchronize this?
    d3.json("bank.json", function(error, full_bank) {
        d3.json(type["filename"], function(error, data) {
            // Draw some dots!
            mass1 = data["mass1"];
            mass2 = data["mass2"];
            data = data["overlap"];
            scatter_plot(data, main, x, y, c, sidebar, full_bank);
        });
    });
}

// Header contains succint round information
// FIXME: More style!
header = d3.select("body").append("div")
	.attr("class", "round_header")
	.style("width", "100%")
	.style("clear", "left")

/*
 * hveto.json is where the round infomration is expected to be stored -- without
 * it, none of this works. The trigger file information is inferred by the
 * information stored in this file, so it must be accurate and complete
 */
d3.json("tmplt_bank.json", function(data) {
	// Create an entry for this round in the header
	header.selectAll("p")
		.data(Object.keys(data["types"]))
		.enter().append("p")
			//.html(function(d) {
			.html(function(k) {
				return "<a href='#type_" + k + "'>Type " + k + "</a>";
			});

	// Loop through the rounds and create a scatter plot section for each
    var i = 0;
    types = Object.keys(data["types"]);
    console.log("Loaded these types: " + types);
    // Dear javascript... learn how to iterate through a dict properly like
    // python. This code is unnecessarily complicated, and you should feel bad
	for (var i = 0; i < types.length; i++) {
		var type = types[i]
        // FIXME: We get the first one, arbitrarily.
		load_data(data["types"][type][0], type);
	}

});
