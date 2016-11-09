/*global $, L, URI*/

var parsed;
var globalState = {};
var map;
var sidebar;
var routeLayer;

L.LatLngBounds.prototype.trim = function (precision) {
    this._northEast.lat = this._northEast.lat.toFixed(precision);
    this._northEast.lng = this._northEast.lng.toFixed(precision);
    this._southWest.lat = this._southWest.lat.toFixed(precision);
    this._southWest.lng = this._southWest.lng.toFixed(precision);
    return this;
};

L.LatLngBounds.prototype.toXobbString = function () {
    // Return bbox string compatible with Overpass API
    return this._southWest.lat + "," + this._southWest.lng + "," + this._northEast.lat + "," + this._northEast.lng;
};

var initMap = function() {
    map = L.map('map')
                   .setView(defaultMapView.coords, defaultMapView.zoom);

    // Ask user location. See map.on('locationfound')
    map.locate();

    L.tileLayer(tiles[localStorage.getItem("otv-tiles")].url, {
        attribution: 'Map data &copy; <a href="//openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: tiles[localStorage.getItem("otv-tiles")].maxZoom
    }).addTo(map);

    sidebar = L.control.sidebar('sidebar').addTo(map);
}

function updateURL() {
    var uri = URI();
    uri.search(globalState);
    history.pushState({globalState: globalState}, null, uri.toString());
    $("#dlForm input[type='text']").each(function () {
        $(this).val(globalState[$(this).attr("name")]);
    });
}

function bindEvents() {
    // To be executed on page load

    var uri = URI();
    // Restore global state from URL parameters
    globalState = uri.search(true);
    if (globalState.bb) {
        $("#bb-check").prop('checked', true);
    }

    $('#dlForm').submit(function (e) {
        e.preventDefault();

        $(this).find("input[type='text']").each(function () {
            if ($(this).val()) {
                globalState[$(this).attr("name")] = $(this).val();
            } else {
                delete globalState[$(this).attr("name")];
            }
        });
        updateURL();
        getRouteMastersByParams(globalState.network, globalState.operator, globalState.ref, globalState.bb);
        sidebar.open("data_display");
    });

    map.on('locationfound', function (l) {
        map.fitBounds(l.bounds, mapPadding);
    });

    map.on('moveend', function () {
        globalState.lat = map.getCenter().lat.toFixed(5);
        globalState.lng = map.getCenter().lng.toFixed(5);
        globalState.z   = map.getZoom();
        if ($("#bb-check").prop("checked")) {
            globalState.bb = map.getBounds().trim(5).toXobbString();
        }
        updateURL();
    });

    $(".otv-settings").on('change', function () {
        localStorage.setItem($(this).attr('id'), $(this).val());
    });

    $("#bb-check").on('change', function () {
        if ($(this).is(':checked')) {
            globalState.bb = map.getBounds().trim(5).toXobbString();
        } else {
            delete globalState.bb;
        }
    });

    $("#routemaster-tags-toggle").on("click", function () {
        $("#routemaster-tags").toggle();
    });
    $("#route-tags-toggle").on("click", function () {
        $("#route-tags").toggle();
    });

    $("#routemaster-displayAll").on("click", displayAllOnMap);

    $("#routemaster-select")
        .removeClass("hidden")
        .change(function () {
            globalState.selrm = $(this).val();
            $("#routemaster-select").val(globalState.selrm);
            updateStatus("dl");
            updateURL();
            getRouteMasterById(globalState.selrm,
                function (route_master) {
                    if (!route_master) {
                        updateStatus("fail", "No route_master found");
                    } else {
                        updateStatus("ok");
                        displayRoutes(route_master);
                    }
                }, function () {
                    updateStatus("fail", "Error while getting route_master data");
                });
        });
}

function updateStatus(status, msg) {
    var level="info";

    $("li#data_tab i").removeClass().addClass("fa");
    switch (status) {
    case "ok":
        $("li#data_tab i").addClass("fa-bars");
        $("li#data_tab").removeClass("disabled");
        break;
    case "dl":
        $("li#data_tab i").addClass("fa-spin fa-spinner");
        $("li#data_tab").addClass("disabled");
        break;
    case "fail":
        level = "warning";
        $("li#data_tab").removeClass("disabled");
        $("li#data_tab i").addClass("fa-exclamation-triangle");
        break;
    default:
        break;
    }

    var divMessage = "";
    if (msg) {
        divMessage = msg;
    } else if (defaultStatusMessages[status] !== undefined) {
        divMessage = defaultStatusMessages[status];
    }
    if (divMessage.length > 0) {
        $("#data-status")
            .removeClass()
            .addClass(level)
            .text(divMessage);
    } else {
        $("#data-status").empty();
    }
}

function guessQuery() {
    // Find what to do on page opening
    if (globalState.rmid) {
        getRouteMasterById(globalState.rmid);
        sidebar.open("data_display");
    } else if (globalState.rmid || globalState.network || globalState.operator || globalState.bb) { // Avoid queries which can match too much routes
        getRouteMastersByParams(globalState.network, globalState.operator, globalState.ref, globalState.bb);
        sidebar.open("data_display");
    } else if (! localStorage.getItem("otv-readIntro")){
        // User has not yet read the help, and haven't made a request or been linked to one
        localStorage.setItem("otv-readIntro", true);
        sidebar.open("info-tab");
    } else {
        sidebar.open("query");
    }
    updateURL();
}

function displayRouteMasters() {
    if (!Object.keys(parsed.route_masters).length) {
        updateStatus("fail", "No route_masters found");
        return;
    }
    updateStatus("ok");
    $("#routemaster-displayAll").removeClass("hidden");
    var sorted = _.sortBy(parsed.route_masters, function (e) {return e.tags.name;});
    $("#routemaster-select").empty();
    $.each(sorted, function (i, r) {
        $("#routemaster-select").append($('<option>', {
            value: r.id,
            text: r.tags.name || r.id,
        }));
    });
    // Always trigger route variant display
    if(globalState.selrm) {
        $("#routemaster-select").val(globalState.selrm);
    }
    $("#routemaster-select").change();
}

function getRouteMastersByParams(network, operator, ref, bbox) {
    updateStatus("dl");

	var netstr = network  ? ("[network~'" + network + "',i]") : "";
	var opstr =  operator ? ("[operator~'" + operator + "',i]") : "";
	var refstr = ref      ? ("[ref~'^" + ref + "$',i]")   : "";

    var base;
    if (bbox) {
        bbox =   bbox ? ("(" + bbox + ")") : "";
        base = 'relation["type"="route"]' + bbox + ";" +
        'relation(br)' + netstr + opstr + refstr;
    } else {
        base = 'relation["type"="route_master"]' + netstr + opstr + refstr;
    }
    getRouteMastersData(base, displayRouteMasters);
}

function clearMap() {
    if (map.hasLayer(routeLayer)) {
        map.removeLayer(routeLayer);
    }
    routeLayer = L.layerGroup();
}

function displayOnMap(route) {
    _.each(route.stop_positions, function (obj) {
        prepareMarker(obj, routeLayer);
    });
    _.each(route.platforms, function (obj) {
        prepareMarker(obj, routeLayer);
    });
    _.each(route.paths, function (obj) {
        prepareMarker(obj, routeLayer, {
            color: path_color[route.tags.route] || "red",

        });
    });
    if(routeLayer.getLayers().length > 0) {
        if(window.innerWidth > mapPadding[0]) {
            map.fitBounds(L.featureGroup(routeLayer.getLayers()).getBounds(), mapPadding);
        } else {
            map.fitBounds(L.featureGroup(routeLayer.getLayers()).getBounds());
        }
        routeLayer.addTo(map);
    }
}

function getTagTable(obj) {
    var tagStr = "<table class='tags'>";
    Object.keys(obj.tags).forEach(function (key) {
        tagStr += `<tr><td class='key'>${key}</td><td class='value'>${obj.tags[key].autoLink()}</td></tr>`;
    });
    tagStr += "</table>";
    return tagStr;
}

function getLatLngArray(osmWay) {
        var latlngs = [];
        _.each(osmWay.nodes, function (n) {
            latlngs.push(L.latLng(n.lat, n.lon));
        });
        return latlngs;
}

function prepareMarker(obj, group, overrideStyle) {
    var markerOptions = {
        autoPan: false
    };
    var popupHTML = `<a href='${osmUrl}${obj.type}/${obj.id}'><h1>${obj.tags.name || "!Missing name!"}</h1></a>
        ${getTagTable(obj)}`;
    if (obj.type == "way") {
        var latlngs = getLatLngArray(obj);
        if (obj.tags.public_transport === "platform") {
            obj.layer = L.polyline(latlngs,{
                color: 'blue',
                weight: 8
            }).bindPopup(popupHTML, markerOptions);
        }
        else {
            obj.layer = L.polyline(latlngs,$.extend({
                weight: 4
            }, overrideStyle)).bindPopup(popupHTML, markerOptions);
       }
    } else {
        if (obj.tags.public_transport === "stop_position") {
            obj.layer = L.marker([obj.lat, obj.lon], {
                icon: iconStopPosition
            })
            .bindPopup(popupHTML, markerOptions);
        } else {
            obj.layer = L.marker([obj.lat, obj.lon])
            .bindPopup(popupHTML, markerOptions);
        }
    }
    group.addLayer(obj.layer);
}

function displayRoutes(route_master) {
    //Display informations relative to the route_master chosen

    $("#routemaster-tags-toggle").removeClass("hidden");
    $("#routemaster-name").text(route_master.tags.name);
    $("#routemaster-tags").html(getTagTable(route_master));

    // Clear data display before displaying new route variants
    $("#routes_list ul").empty();
    $('#stops-list').find("li").remove();

    _.each(route_master.members, function (r) {
        var routeLi = $("<li>").addClass(r.tags.route + "_route");

        $("<a>", {href: osmUrl + "relation" + "/" + r.id})
            .attr("target","_blank")
            .append($("<img>", {src: route_icons[r.tags.route], alt: "route on osm.org"}))
            .appendTo(routeLi);

        $("<span>")
            .text(r.tags.name)
            .prop("title", r.tags.name)
            .attr("data-osmid", r.id)
            .on("click", function () {
                $("#routes_list>ul>li>span").removeClass("selected_route");
                $(this).addClass("selected_route");
                updateURL();
                displayRouteData(parsed.routes[$(this).data("osmid")]);
                clearMap();
                displayOnMap(parsed.routes[$(this).data("osmid")]);
            })
            .appendTo(routeLi);

        $("#routes_list>ul").append(routeLi);
    });
    // Display the first route variant if it exists
    if(route_master.members[0]) {
        var id = route_master.members[0].id;
        $(`span[data-osmID=${id}]`).addClass("selected_route");
        clearMap();
        displayRouteData(parsed.routes[id]);
        displayOnMap(parsed.routes[id]);
    }
}

function displayAllOnMap() {
    clearMap();
    _.each(parsed.routes, displayOnMap);
}

function displayRouteData(route) {
    // Display route tags
    $("#route-tags").html(getTagTable(route));
    $("#route-tags-toggle").show();

    // Clear data display before new display
    $('#stops-list').find("li").remove();
    var master_li;
    _.each(route.members, function (member) {
        if (!member.role.match(/stop(_entry_only|_exit_only)?/)) {
            return;
        }
        master_li = $("<li>");
        stop_ul = $("<ul>");
        if (member.stop_area) {
            $("<a>", {href: osmUrl + "relation/" + member.stop_area.id})
                .append($("<img>", {src: "img/relation.svg", alt: "stop_area relation"}))
                .appendTo(master_li);
            $("<span>").html(member.stop_area.tags.name || member.stop_area.id)
                .addClass("route_master-name")
                .appendTo(master_li);
        } else {
            $("<span>")
                .text("Missing stop_area relation")
                .addClass("route_master-name")
                .appendTo(master_li);
        }
        stop_li = $("<li>");
        $("<a>", {href: osmUrl + member.type + "/" + member.id, "data-osm": member.id})
            .append($("<img>", {src: "img/stop_position_32.png", alt: "Stop_position"}))
            .appendTo(stop_li);
        $("<span>")
            .text("♿")
            .addClass("wheelchair feature_" + member.tags.wheelchair)
            .appendTo(stop_li);
        $("<span>").html(member.tags.name || member.id)
            .appendTo(stop_li);
        stop_li.on("click", null, member, function () {
            member.layer.openPopup();
        })
        .on("mouseleave", null, member, function () {
            member.layer.closePopup();
        });
        stop_ul.append(stop_li);

        var platforms = findPlatforms(route, member.stop_area);
        _.each(platforms, function (platform) {
            var platform_li = $("<li>");
            $("<a>", {href: osmUrl + platform.type + "/" + platform.id})
                .append($("<img>", {src: "img/platform_14.png", alt: "Platform"}))
                .appendTo(platform_li);
            $("<span>")
                .text("♿")
                .addClass("wheelchair feature_" + platform.tags.wheelchair)
                .appendTo(platform_li);
            $("<span>")
                .text(platform.tags.name || platform.id)
                .appendTo(platform_li);

            platform_li.on("click", null, member, function () {
                platform.layer.openPopup();
            })
            .on("mouseleave", null, platform, function () {
                platform.layer.closePopup();
            })
            .appendTo(stop_ul);
        });
        master_li.append(stop_ul);
        $('#stops-list').append(master_li);
    });
}

function findPlatforms(route, stop_area) {
	if (!stop_area) {
		return [];
    }
    platform_regex = new RegExp("platform(_entry_only|_exit_only)?");
    var route_platforms = _.filter(route.members, function (p){return platform_regex.test(p.role);});
    var area_platforms = _.filter(stop_area.members, function (p){return platform_regex.test(p.role);});
    return _.intersection(route_platforms, area_platforms);
}

function initOptions() {
    for (var o in defaultOptions) {
        if (defaultOptions.hasOwnProperty(o) && !localStorage.getItem(o)) {
            localStorage.setItem(o, defaultOptions[o]);
        }
    }
    $(".otv-settings").each(function () {
        $(this).val(localStorage.getItem($(this).attr('id')));
    });
}

initOptions();
initMap();
bindEvents();
guessQuery();
