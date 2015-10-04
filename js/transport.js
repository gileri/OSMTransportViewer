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

var mapPadding = {
    paddingTopLeft: [500,50],
}

var defaultOptions = {
    "opapi": "//overpass-api.de/api"
};
var globalState = {};

L.LatLngBounds.prototype.trim = function(precision) {
    this._northEast.lat = this._northEast.lat.toFixed(precision);
    this._northEast.lng = this._northEast.lng.toFixed(precision);
    this._southWest.lat = this._southWest.lat.toFixed(precision);
    this._southWest.lng = this._southWest.lng.toFixed(precision);
    return this;
}

L.LatLngBounds.prototype.toXobbString = function() {
    // Return bbox string compatible with Overpass API
    return this._southWest.lat + "," + this._southWest.lng + "," + this._northEast.lat + "," + this._northEast.lng;
}

var map = L.map('map')
               .setView([45.75840835, 4.8956966], 13);

// Ask user location. See map.on('locationfound')
map.locate();

L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="//openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
}).addTo(map);

var sidebar = L.control.sidebar('sidebar').addTo(map);
var routeLayer;

function bindEvents () {
    // To be executed on page load

    var uri = URI();
    // Restore global state from URL parameters
    globalState = uri.search(true);
    if(globalState.bb) {
        $("#bb-check").prop('checked', true);
    }
    
    $('#dlForm').submit(function(e) {
        e.preventDefault();

        $(this).find("input[type='text']").each(function() {
            if($(this).val()) {
                globalState[$(this).attr("name")] = $(this).val();
            } else {
                delete globalState[$(this).attr("name")];
            }
        });
        updateURLForm();
        getRouteMasters(globalState.network, globalState.operator, globalState.ref, globalState.bb);
        sidebar.open("data_display");
    });

    map.on('locationfound', function(l) {
        map.fitBounds(l.bounds, mapPadding);
    });

    map.on('moveend', function() {
        globalState.lat = map.getCenter().lat.toFixed(5)
        globalState.lng = map.getCenter().lng.toFixed(5)
        globalState.z   = map.getZoom()
        if($("#bb-check").prop("checked")) {
            globalState.bb = map.getBounds().trim(5).toXobbString();
        }
        updateURLForm();
    });

    $(".otv-settings").on('change', function(e) {
        localStorage.setItem($(this).attr('id'), $(this).val());
    });

    $("#bb-check").on('change', function(e) {
        if($(this).is(':checked')) {
            globalState.bb = map.getBounds().trim(5).toXobbString();
        } else {
            delete globalState.bb;
        }
        updateURLForm();
    });
}

function updateURLForm() {
    var uri = URI();
    uri.search(globalState);
    history.pushState({globalState: globalState}, null, uri.toString());

    //$("#dlForm input.[type='text']").each(function() {
    //    $(this).val(globalState[$(this).attr("name")]);
    //})
}

function guessQuery() {
    if(globalState.id) {
        getRouteMaster(globalState.id);
        sidebar.open("data_display");
    } else if (globalState.rmid || globalState.network || globalState.operator || globalState.bb) { // Avoid queries which can match too much routes
        getRouteMasters(globalState.network, globalState.operator, globalState.ref, globalState.bb);
        sidebar.open("data_display");
    } else {
        sidebar.open("query"); // Ask parameters
    }
}

function dlRouteMasters(query) {
    updateURLForm();
    $("#data-error").empty();
    $.ajax(localStorage.getItem("otv-opapi") + "/interpreter", {
        type: "POST",
        data: query,
    }).done(function (op_data, a, b) {
        $("li#data_tab i").removeClass("fa-spin fa-spinner");
        $("li#data_tab").removeClass("disabled")
        if(op_data.elements.length === 0) {
            $("#data-error").html('No route_master found');
            $("li#data_tab i").addClass("fa-exclamation-triangle");
        } else {
            displayRouteMasters(op_data);
            $("li#data_tab i").addClass("fa-bars");
        }
    }).fail(function (op_data, error, exception) {
        $("#data-error").html(error);
        $("li#data_tab i").removeClass("fa-spin fa-spinner").addClass("fa-exclamation-triangle");
    }).always(function () {
        $("#dlForm>input[type=submit]").prop("disabled", false);
        if(globalState.rmid) {
            $("#routemaster-select option[value=" + globalState.rmid +"]").prop('selected', 'true');
            getRouteMaster(globalState.rmid);
        }
    });
}

function getRouteMasters(net, op, ref, bbox) {
    $("li#data_tab i").removeClass().addClass("fa fa-spinner fa-spin");

	var netstr = net  ? ("[network~'" + net + "',i]") : "";
	var opstr =  op   ? ("[operator~'" + op + "',i]") : "";
	var refstr = ref  ? ("[ref~'^" + ref + "$',i]")   : "";

    if(bbox) {
        var bbox =   bbox ? ("(" + bbox + ")") : "";
        var query = '[out:json];' +
        'relation["type"="route"]' + bbox + ";" +
        'relation(br)' + netstr + opstr + refstr + ';' +
        'out body;';
    } else {
        var query = '[out:json];' +
        'relation["type"="route_master"]' + netstr + opstr + refstr + ';' +
        'out body;';
    }
    dlRouteMasters(query);
}

function displayRouteMasters(data) {
    var sorted = _.sortBy(data.elements, function(e) {return e.tags.name});
    $("#routemaster-select").empty();
    $.each(sorted, function(i, r) {
        $("#routemaster-select").append($('<option>', {
            value: r.id,
            text: r.tags.name || r.id,
        }));
    });
    $("#routemaster-select").removeClass("hidden");
    $("#routemaster-dl")
        .click(function() {
            var masterId = $("#routemaster-select option:selected").val();
            globalState.rmid = masterId;
            getRouteMaster(globalState.rmid);
        })
        .removeClass("hidden");
}

function getRouteMaster(id) {
    $("#routemaster-dl").prop('disabled', true);
    updateURLForm();
    $("li#data_tab").removeClass("disabled");
    $("li#data_tab i").removeClass().addClass("fa fa-spinner fa-spin");
    sidebar.open("data_display");

    query='[out:json];' +
    'relation["type"="route_master"](' + id + ')->.route_masters;' +
    'rel(r.route_masters)->.routes;' +
    'node(r.routes)->.stops;' +
    '(' +
      'way(r.routes)["highway"];' +
      'way(r.routes)["railway"];' +
    ')->.paths;' +
    'node(w.paths)->.paths_nodes;' +
    '(' +
      'node(r.routes:"platform");' +
      'way (r.routes:"platform");' +
    ');' +
    '(._;>;)->.platforms;' +
    '(' +
      'relation(bn.stops)["type"="public_transport"]["public_transport"="stop_area"];' +
      'relation(bw.stops)["type"="public_transport"]["public_transport"="stop_area"];' +
    ')->.stop_areas;' +
    '(' +
      '.route_masters;' +
      '.routes;' +
      '.stop_areas;' +
      '.stops;' +
      '.paths;' +
      '.platforms;' +
      '.paths_nodes;' +
    ');' +
    'out body;';

    $("#dlForm>input[type=submit]").prop("disabled", true);
    $("#data-error").empty();
    $.ajax(localStorage.getItem("otv-opapi") + "/interpreter", {
        type: "POST",
        data: query,
    }).done(function (op_data) {
        displayRoutes(parseOSM(op_data));
        $("li#data_tab i").removeClass("fa-spin fa-spinner").addClass("fa-bars");
    }).fail(function (op_data) {
        $("li#data_tab i").removeClass("fa-spin fa-spinner").addClass("fa-exclamation-triangle");
    }).always(function () {
        $("#dlForm>input[type=submit]").prop("disabled", false);
        $("#routemaster-dl").prop('disabled', false);
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
        prepareMarker(obj, parsedData, routeLayer, {
            color: path_color[route.tags.route] || "red",

        });
    });
    map.fitBounds(L.featureGroup(routeLayer.getLayers()).getBounds(), mapPadding);
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

function prepareMarker(obj, parsedData, group, overrideStyle) {
    var popupHTML = `<h1>${obj.tags.name || "!Missing name!"}</h1>${getTagTable(obj)}`
    if(obj.type == "way") {
        var latlngs = getLatLngArray(obj);
        if(obj.tags["public_transport"]=="platform") {
            obj.layer = L.polyline(latlngs,{
                color: 'red',
                weight: 12
            }).bindPopup(popupHTML);
        }
        else {
            obj.layer = L.polyline(latlngs,$.extend({
                weight: 4
            }, overrideStyle)).bindPopup(popupHTML);
       }
    } else {
        obj.layer = L.marker([obj.lat, obj.lon])
                    .bindPopup(popupHTML);
    }
    group.addLayer(obj.layer);
}

function displayRoutes(parsed) {
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
                updateURLForm();
                displayRouteData(parsed, parsed.routes[$(this).data("osmID")]);
                displayOnMap(parsed, parsed.routes[$(this).data("osmID")])
            })
            .appendTo(routeLi);
        $("<a>", {href: osmUrl + "relation" + "/" + r.id})
            .text("(rel ↗)")
            .appendTo(routeLi);

        $("#routes_list>ul").append(routeLi);
    });
};

var displayRouteData = function(data, route) {
    // Un-hide stop list table header
    $("tr#stop_list_header").removeClass("hidden");
    // Clear data display before new display
    $('#stops-list>table').find("tr:gt(0)").remove();
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
        $('#stops-list>table').append(stop_tr);
    });
}

function findPlatform(data, route, stop_area) {
	if(!stop_area)
		return [];
    var route_platforms = _.filter(route.members, function(p){return p.role.match(/platform(_entry_only|_exit_only)?/)});
    var area_platforms = _.filter(stop_area.members, function(p){return p.role.match(/platform(_entry_only|_exit_only)?/)});
    return _.intersection(route_platforms, area_platforms);
}

function initOptions() {
    for (o in defaultOptions) {
        if(!localStorage.getItem("otv-" + o)) {
            // Add a prefix to localStored options to avoid conflicts
            localStorage.setItem("otv-" + o, defaultOptions[o]);
        }
    }
    $(".otv-settings").each(function(o) {
        $(this).val(localStorage.getItem($(this).attr('id')));
    });
}

function populateOptionsInputs() {
    var filteredLocalStorage = _.filter(localStorage, function(i){
        return i.lastIndexOf(i, 0);
    });
    for (o in filteredLocalStorage) {
        $("#" + o).value(localStorage.getItem(o));
    }
}

initOptions();
bindEvents();
guessQuery();
