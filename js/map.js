var opapi = "//overpass-api.de/api/interpreter";
var osmUrl = "//openstreetmap.org/";

var path_color = {
	bus: 'blue',
	subway: 'red',
	trolleybus: 'green',
	tramway: 'black',
};
var path_weight = 2;

var stopIcon = L.icon({
    iconUrl: './img/stop.png',
    iconSize: [12, 12],
});

var qNet = "";
var qOp = "";
var qRef = "";
var qId = "";

var map = L.map('map')
               .setView([45.75840835755788, 4.895696640014648], 13);

L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="//openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
}).addTo(map);
var sidebar = L.control.sidebar('sidebar').addTo(map);
var routeLayer;

function getURLParameter(name) {
    // From http://stackoverflow.com/a/11582513/1032870
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

function bindEvents () {
    // To be executed on page load

    // Populate inputs from URL parameters
    qNet = getURLParameter("network");
    qOp  = getURLParameter("op");
    qRef = getURLParameter("ref");
    qId  = getURLParameter("id");
    
	$('#netInput').val(qNet);
	$('#opInput' ).val(qOp);
	$('#refInput').val(qRef);
	$('#idInput').val( qId);
    chooseQuery();
}

function chooseQuery() {
    if(qId) {
        getRouteMaster(qId);
        sidebar.open("data_display");
    } else if (qRef && (qNet || qOp)) { // Avoid queries which can match too much routes
        getRouteMasters(qNet, qOp, qRef);
        sidebar.open("data_display");
    } else {
        sidebar.open("query"); // Ask parameters
    }
}

function dlRouteMasters(query) {
    $.ajax(opapi, {
        type: "POST",
        data: query,
    }).done(function (op_data) {
        displayRouteMasters(op_data);
        $("li#data_tab i").removeClass("fa-spin fa-spinner").addClass("fa-bars");
        $("li#data_tab").removeClass("disabled")
    }).fail(function (op_data) {
        $("li#data_tab i").removeClass("fa-spin fa-spinner").addClass("fa-exclamation-triangle");
    }).always(function () {
        $("#dlForm>input[type=submit]").prop("disabled", false);
        $("li#data_tab i").removeClass().addClass("fa fa-bars");
    });
}

function getRouteMasters(net, op, ref) {
    $("li#data_tab i").removeClass().addClass("fa fa-spinner fa-spin");
	var netstr = net ? ("[network~'" + net + "',i]") : "";
	var opstr = op ? ("[operator~'" + op + "',i]") : "";
	var refstr = ref ? ("[ref~'^" + ref + "$',i]") : "";

    query='[out:json];' +
    'relation["type"="route_master"]' + netstr + opstr + refstr + ';' +
    'out body;'

    dlRouteMasters(query);
}

function getRouteMastersBbox() {
    $("li#data_tab i").removeClass().addClass("fa fa-spinner fa-spin");
	var bbox = map.getBounds().toBBoxString();

    query='[out:json];' +
    'relation["type"="route_master"](' + bbox + ');' +
    'out tags;'

    dlRouteMasters(query);
}

function displayRouteMasters(data) {
    $.each(data.elements, function(i, r) {
        $("#routemaster-select").append($('<option>', {
            value: r.id,
            text: r.tags.name || r.id,
        }));
    });
    $("#routemaster-select").removeClass("hidden");
    $("#routemaster-dl")
        .click(function() {
            getRouteMaster($("#routemaster-select option:selected").val());
        })
        .removeClass("hidden");
}

function getRouteMaster(id) {
    $("li#data_tab").removeClass("disabled");
    $("li#data_tab i").removeClass().addClass("fa fa-spinner fa-spin");
    sidebar.open("data_display");

    query='[out:json];' +
    'relation["type"="route_master"](' + id + ')->.route_masters;' +
    'rel(r.route_masters)->.routes;' +
    'node(r.routes)->.stops;' +
    'way(r.routes)["highway"]->.paths;' +
    'node(w.paths)->.paths_nodes;' +
    '(' +
    '  node(r.routes:"platform");' +
    '  way (r.routes:"platform");' +
    ');' +
    '(._;>;)->.platforms;' +
    '(' +
    '  relation(bn.stops)["type"="public_transport"]["public_transport"="stop_area"];' +
    '  relation(bw.stops)["type"="public_transport"]["public_transport"="stop_area"];' +
    ')->.stop_areas;' +
    '(' +
    '  .route_masters;' +
    '  .routes;' +
    '  .stop_areas;' +
    '  .stops;' +
    '  .paths;' +
    '  .platforms;' +
    '  .paths_nodes;' +
    ');' +
    'out body;';

    $("#dlForm>input[type=submit]").prop("disabled", true);
    $.ajax(opapi, {
        type: "POST",
        data: query,
    }).done(function (op_data) {
        parseAndDisplay(op_data);
        $("li#data_tab i").removeClass("fa-spin fa-spinner").addClass("fa-bars");
    }).fail(function (op_data) {
        $("li#data_tab i").removeClass("fa-spin fa-spinner").addClass("fa-exclamation-triangle");
    }).always(function () {
        $("#dlForm>input[type=submit]").prop("disabled", false);
        $("li#data_tab i").removeClass().addClass("fa fa-bars");
    });
}

function displayOnMap(parsedData, route) {
    if(map.hasLayer(routeLayer))
        map.removeLayer(routeLayer);
    routeLayer = L.layerGroup();

    _.each(route.stop_positions, function(obj, index, parsedData) {
        prepareMarker(obj, parsedData, routeLayer);
    });
    _.each(route.platforms, function(obj, index, parsedData) {
        prepareMarker(obj, parsedData, routeLayer);
    });
    _.each(route.paths, function(obj, index, parsedData) {
        preparePath(obj, parsedData, routeLayer);
    });
    routeLayer.addTo(map);
}

function getTagTable(obj) {
    var tagStr = "<table>";
    Object.keys(obj.tags).forEach(function(key) {
        tagStr += `<tr><td>${key}</td><td>${obj.tags[key]}</td></tr>`;
    });
    tagStr += "</table>";
    return tagStr;
}

function getLatLngArray(osmWay) {
        var latlngs = [];
        _.each(osmWay.nodes, function(n) {
            latlngs.push(L.latLng(n.lat, n.lon));
        });
        return latlngs;
}

function prepareMarker(obj, parsedData, group) {
    var popupHTML = `<h1>${obj.tags.name || "!Missing name!"}</h1>${getTagTable(obj)}`
    if(obj.type == "way") {
        latlngs = getLatLngArray(obj);
        obj.layer = L.polyline(latlngs,{
            color: 'red',
            weight: 12
        })
        .bindPopup(popupHTML);;
    } else {
        obj.layer = L.marker([obj.lat, obj.lon])
                    .bindPopup(popupHTML);
    }
    group.addLayer(obj.layer);
}

function preparePath(obj, parsedData, group) {
    var popupHTML = `<h1>${obj.tags.name || "!Missing name!"}</h1>${getTagTable(obj)}`
    var latlngs = getLatLngArray(obj);
    group.addLayer(L.polyline(latlngs, {
        color: 'green'
    })
    .bindPopup(popupHTML));
}

function parseAndDisplay(op_data) {
    var parsed = parseOSM(op_data);

    // Clear data display before new display
    $("#routes_list ul").empty()

    _.each(parsed.routes, function(r) {
        var routeLi = $("<li>").addClass(r.tags.route + "_route");
        $("<span>")
            .text(r.tags.name + " ")
            .data("osmID", r.id)
            .on("click", function(event) {
                $("#routes_list>ul>li>span").removeClass("selected_route");
                $(this).addClass("selected_route");
                displayRoute(parsed, parsed.routes[$(this).data("osmID")]);
            })
            .appendTo(routeLi);
        $("<a>", {href: osmUrl + "relation" + "/" + r.id})
            .text("(rel ↗)")
            .appendTo(routeLi);

        $("#routes_list>ul").append(routeLi);
    });
};

var displayRoute = function(data, route) {
    displayOnMap(data, route)
    // Un-hide stop list table header
    $("tr#stop_list_header").removeClass("hidden");
    // Clear data display before new display
    $('#stops_list>table').find("tr:gt(0)").remove();
    var stop_li;
    _.each(route.members, function(member) {
        stop_tr = $("<tr>");
        
        if(!member.role.match(/stop(_entry_only|_exit_only)?/))
            return;
        stop_td = $("<td>")
            .append($("<a>", {href: osmUrl + member.type + "/" + member.id,
                              "data-osm": member.id})
            .on("mouseenter", null, member, function(e) {
                member.layer.openPopup();
            })
            .on("mouseleave", null, member, function(e) {
                member.layer.closePopup();
            })
            .text(member.tags.name || "!Missing name!")
            );
        $("<span>")
            .text("♿")
            .addClass("wheelchair feature_" + member.tags.wheelchair)
            .appendTo(stop_td);
        stop_tr.append(stop_td)
        if(member.stop_area)
            stop_tr.append($("<td>").append($("<a>", {href: osmUrl + "relation/" + member.stop_area.id}).text(member.stop_area.tags.name || member.stop_area.id)));

        var platforms = findPlatform(data, route, member.stop_area);
        var platform_ul = $("<ul>");
        _.each(platforms, function(platform) {
            var platform_li = $("<li>");
            $("<a>", {href: osmUrl + platform.type + "/" + platform.id})
            .text(platform.id) //TODO display name OR id
            .appendTo(platform_li);
            $("<span>")
            .text("♿")
            .addClass("wheelchair feature_" + member.tags.wheelchair)
            .appendTo(platform_li);

            platform_li.on("mouseenter", null, member, function(e) {
                platform.layer.openPopup();
            })
            .on("mouseleave", null, platform, function(e) {
                platform.layer.closePopup();
            })
            .appendTo(platform_ul);
        });
        var shelter_ul = $("<ul>");
        _.each(platforms, function(platform) {
            $("<li>")
            .text(platform.tags.shelter)
            .appendTo(shelter_ul);
        });
        var bench_ul = $("<ul>");
        _.each(platforms, function(platform) {
            $("<li>")
            .text(platform.tags.bench)
            .appendTo(bench_ul);
        });
        $("<td>").append(platform_ul).appendTo(stop_tr);
        $("<td>").append(shelter_ul).appendTo(stop_tr);
        $("<td>").append(bench_ul).appendTo(stop_tr);
        $('#stops_list>table').append(stop_tr);
    });
}

function findPlatform(data, route, stop_area) {
	if(!stop_area)
		return [];
    var route_platforms = _.filter(route.members, function(p){return p.role.match(/platform(_entry_only|_exit_only)?/)});
    var area_platforms = _.filter(stop_area.members, function(p){return p.role.match(/platform(_entry_only|_exit_only)?/)});
    return _.intersection(route_platforms, area_platforms);
}

bindEvents();
