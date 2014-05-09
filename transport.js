var osm_url = "https://www.openstreetmap.org/";

var network;
var line;
var verbose;
var chart;

var route_masters;
var lines;
var areas;
var stops;

function checkParams() {
    var hash = window.location.hash.substring(1);
    var params = hash.split("-");
    if(params.length == 3) {
        document.getElementById('network').value = params[0];
        document.getElementById('line').value = params[1];
        document.getElementById('verbose').checked = (params[2] == "v" ? true : false);
        dl();
    }
}

function dl() {
    network = document.getElementById('network').value;
    line    = document.getElementById('line').value;
    verbose = document.getElementById('verbose').checked;
    api_c   = document.getElementById('api_c').value;
    switch(api_c) {
      case "overpass-api.de":
        api = "https://overpass-api.de/api/interpreter";
        break;
      case "api.openstreetmap.fr":
        api = "http://api.openstreetmap.fr/oapi/interpreter";
        break;
      default:
        api=api_c;
    }
    params = network + '-' + line + '-' + (verbose ? "v" : "q");
    if (params !== window.location.hash)
        window.location.hash = network + '-' + line + '-' + (verbose ? "v" : "q");
    var query = '[out:json];relation["type"="route_master"]["network"~"' + network + '",i]["ref"~"^' + line + '$",i];out;rel(r);out;node(r);out;relation(bn)["type"="public_transport"]["public_transport"="stop_area"];out;foreach(>>;relation(bn)[type=route];out;);';
    console.log("Overpass query : " + query);
    var data  = {
        "data": query,
    };
    document.getElementById("load_text").innerHTML = "Loading from Overpass API...";
    //$.getJSON("./data.json", null, parse);
    $.getJSON(api, data, parse);
}
function init_stop(id) {
    if(!stops[id]) {
        stops[id] = new Object();
    }
}

function connections() {
    lines.forEach(function (l) {
        l.stops.forEach(function(m) {
            if(stops[m] && stops[m].area) {
               if(!stops[m].area.connections)
                   stops[m].area.connections = [];
                stops[m].area.connections.push(l);
            }
        });
    });
}

function parse(data) {
    route_masters = [];
    lines = [];
    areas = [];
    stops = [];
    document.getElementById("load_text").innerHTML = "Parsing...";
    data.elements.forEach(function(e) {
            if(e.type == "relation") {
            switch(e.tags.type) {
            case "route_master":
            route_masters.push(e);
            case "route":
            r = [];
            r.tags = e.tags;
            r.id = e.id;
            r.stops = [];
            e.members.forEach(function(m) {
                if(m.role == "stop" || m.role == "stop_exit_only" || m.role == "stop_entry_only") {
                    r.stops.push(m.ref);
                }

            });
            lines[r.id] = r;
            break;
            case "public_transport":
            areas[e.id] = e;
            e.members.forEach( function(n) {
                if(n.role == "stop") {
                    init_stop(n.ref);
                    stops[n.ref].area = e;
                }
                });
            break;
            }
            } else if(e.type == "node") {
                init_stop(e.id);
                stops[e.id].node = e;
            }
    });
    connections();
    render();
}

function render() {
    document.getElementById("load_text").innerHTML = "Rendering...";
    var font_size = 16;
    var step = 50;
    var stop_radius = 8;
    var first_padding = 20;
    var connection_padding = 5*font_size;
    var line_padding = 300 + stop_radius / 2;
    var max_stops = 0;

    var route_master = route_masters[0];

    d3.select("svg").remove();

    var line;
    route_master.members.forEach(function(l) {
        line = lines[l.ref];
        max_stops = Math.max(max_stops, line.stops.length);
    });
    delete line;

    var chart = d3.select("#content")
        .append("svg:svg")
        .attr("class", "chart")
        .attr("width", step * max_stops + line_padding/2)
        .attr("height", line_padding * route_master.members.length + stop_radius + font_size*10)
        .attr("id", "svg");

    var i = 0;
    route_master.members.forEach(function(line_id) {
        line = lines[line_id.ref];
        var line_colour = line.tags.colour || "steelblue";

        chart.append("line")
        .attr("x1", 5)
        .attr("y1", (i+1) * line_padding)
        .attr("x2", step * line.stops.length + first_padding)
        .attr("y2", (i+1) * line_padding)
        .attr("stroke", line_colour)
        .attr("stroke-width", "6")
        .attr("stroke-linecap", "round")

        chart.append("a")
        .attr("xlink:href", osm_url + 'relation/' + line.id)
        .append("text")
        .attr("x", 5)
        .attr("y", i * line_padding + font_size + (i>0 ? connection_padding : 0))
        .attr("font-size", font_size + "px")
        .attr("fill", line_colour)
        .text(line.tags.name + ' (' + line.tags.ref + ')');

        for(var j=0; j<line.stops.length; j++) {
            var stop_ref = line.stops[j];
            var stop = stops[stop_ref];
            var area_found = true;
            var text = "default";
            if(stop && stop.area) {
                text = stop.area.tags.name;
            } else if(stop.node && stop.node.tags.name) {
                text = stop.node.tags.name;
                area_found = false;
            }
            node_url = osm_url + "node/" + stop_ref;

            chart.append("a")
                .attr("xlink:href", node_url)
                .append("circle")
                .attr("cx", first_padding + j * step)
                .attr("cy", (i+1) * line_padding)
                .attr("r", stop_radius)
                .attr("radius", "12")
                .attr("fill", "red");

            xtext = step * j + first_padding;
            ytext = (i+1) * line_padding - stop_radius;
            chart.append("a")
                .attr("xlink:href", node_url)
                .append("text")
                .attr("x", xtext)
                .attr("y", ytext)
                .attr("fill", ((verbose && !area_found) ? "red" : "black"))
                .attr("text-anchor", "beginning")
                .attr("font-size", "16px")
                .attr("transform", "rotate(" + "-45 " + xtext + " " + ytext + ")")
                .text(text || "Missing stop_area");

            var k = 1;
            var u = [];
            if(stop.area)
            stop.area.connections.forEach(function(c) {
                if(u.length < 5 && !(line.tags.ref === c.tags.ref) && u.indexOf(c.tags.ref) == -1) {
                    chart.append("a")
                      .attr("xlink:href", "#" + c.tags.network + "-" + c.tags.ref + "-" + (verbose ? "v" : "q"))
                      .append("text")
                          .attr("x", xtext)
                          .attr("y", ytext + 2 * stop_radius + k * font_size)
                          .attr("text-anchor", "middle")
                          .attr("font-size", font_size / 2 + "px")
                          .text(c.tags.ref);
                    u.push(c.tags.ref);
                    k++;
                }
            });
        }
        i++;
    });
    $("#load_text").html(download_svg());
}

function download_svg() {
    //var tmp = document.getElementById("content");
    var svg = document.getElementsByTagName("svg")[0];
    var svg_xml = (new XMLSerializer).serializeToString(svg);
    return("<a href-lang='image/svg+xml' href='data:image/svg+xml," + encodeURIComponent(svg_xml) + "' title='route.svg'>Download SVG file</a>");
}
