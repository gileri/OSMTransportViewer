var osm_url = "https://www.openstreetmap.org/";
var max_connections_displayed = 5;

var type;
var network;
var line;
var verbose;
var chart;

var route_masters;
var lines;
var areas;
var stops;

function checkParams() {

    // Listen to request type selection change
    $('#type').change(function() {
        type = $('#type').val();
        if(type == 'r') {
            $('.s_input').hide();
            $('.r_input').show();
        } else if (type == 's') {
            $('.r_input').hide();
            $('.s_input').show();
        }
    });

    // Try to infer query from URL

    try {
        // Strip the # first
        var path = window.location.hash.substr(1).split('/');
        var type = path[0];
        var data = path[1].split('+');

        $('#type').val(type); 
        if(type == 'r') {
            if(data.length != 3)
                return;
            $('#network').val(decodeURIComponent(data[0]));
            $('#line').val(decodeURIComponent(data[1]));
            $('#verbose').val(decodeURIComponent(data[2]));
        } else if (type == 's') {
            if(data.length != 1)
                return;
            $('#stop').val(decodeURIComponent(data[0]));
        }
        dl();
    } catch(err) {
        // Invalid URL fragment, move along
        console.log(err);
    }

}

function dl() {
    // Infer from inputs, supposedly valids
    var api_c   = $('#api_c').val();

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

    type = $('#type').val();
    if(type == 'r') {
        dlLine();
    } else if (type == 's') {
        dlStop();
    }
}

function dlStop() {
    // TODO
    var stop = $('#stop').val();
    if(isNaN(stop))
        var query = "[out:json];rel[name~'" + stop + "',i];out tags;node(r:stop);rel(bn)[type=route];out tags;"
    else
        var query = "[out:json];rel(" + stop + ");out tags;node(r:stop);rel(bn)[type=route];out tags;"
    $("#overpass_query").val(query);
    $("#overpass_query").show();

    var hash = '#' + type + '/' + encodeURIComponent(stop);
    // Update fragment only if outdated, to avoid loops
    if (hash != window.location.hash)
        window.location.hash = hash;

    var data  = {
        "data": query,
    };

    $("#load_text").html("Loading from Overpass API...");
    $.getJSON(api, data, parse_connections);
}

function dlLine() {
    network = $('#network').val();
    line    = $('#line').val();
    verbose = $('#verbose').val();

    var hash = '#' + type + '/' + encodeURIComponent(network) + '+' + encodeURIComponent(line) + (verbose ? "+v" : "+q");
    // Update fragment only if outdated, to avoid loops
    if (hash != window.location.hash)
        window.location.hash = hash;

    var query = '[out:json];relation["type"="route_master"]["network"~"' + network + '",i]["ref"~"^' + line + '$",i];out;rel(r);out;node(r);out;relation(bn)["type"="public_transport"]["public_transport"="stop_area"];out;foreach(>>;relation(bn)[type=route];out;);';
    $("#overpass_query").val(query);
    $("#overpass_query").show();

    var data  = {
        "data": query,
    };
    $("#load_text").html("Loading from Overpass API...");

    //Static data to test without straining Overpass servers
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
    $("#load_text").html("Parsing...");
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

function parse_connections(data) {
    var stop = data.elements[0];
    $("#content").html("<h2>Stop : " + stop.tags.name + ", network : " + stop.tags.network + "</h2><span>Available connections :</span>");
    $("#content").append("<ul id='connections'></ul>");
    data.elements.slice(1).forEach(function(e) {
        $("#connections").append("<li><a href='#r/" + encodeURIComponent(e.tags.network) + '+' + encodeURIComponent(e.tags.ref) + (verbose ? "+v" : "+q") + "'>" + e.tags.name + "</a></li>");
    });
    $("#load_text").empty();
}

function render() {
    $("#load_text").html("Rendering...");
    var font_size = 16;
    var step = 50;
    var stop_radius = 8;
    var first_padding = 20;
    var connection_padding = 5*font_size;
    var line_padding = 300 + stop_radius / 2;
    var max_stops = 0;

    var route_master = route_masters[0];

    //d3.select("svg").remove();
    $("#content").empty();

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
            if(stop.area)
                point_url = "#s/" + stop.area.id;
            else
                point_url = osm_url + "node/" + stop_ref;

            chart.append("a")
              .attr("xlink:href", point_url)
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
                    if(u.length < max_connections_displayed && !(line.tags.ref === c.tags.ref) && u.indexOf(c.tags.ref) == -1) {
                        chart.append("a")
                          .attr("xlink:href", "#r/" + c.tags.network + "+" + c.tags.ref + "+" + (verbose ? "v" : "q"))
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
    var svg = document.getElementsByTagName("svg")[0];
    var svg_xml = (new XMLSerializer).serializeToString(svg);
    return("<a href-lang='image/svg+xml' href=\"data:image/svg+xml," + encodeURIComponent(svg_xml) + "\" title='route.svg'>Download SVG file</a>");
}
