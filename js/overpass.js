function getRouteMastersData(base, done, fail, always) {
    var query = '[out:json];' +
    base + '->.route_masters;' +
    'rel(r.route_masters)->.routes;' +
    'node(r.routes)->.stops;' +
    'way(r.routes)[~"(high|rail)way"~"."]->.paths;' +
    'node(w.paths)->.paths_nodes;' +
    '(' +
      'node(r.routes:"platform");' +
      'node(r.routes:"platform_entry_only");' +
      'node(r.routes:"platform_exit_only");' +
      'way (r.routes:"platform");' +
      'way (r.routes:"platform_entry_only");' +
      'way (r.routes:"platform_exit_only");' +
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
    }).done(function (data) {
        parsed = parseOSM(data);
        done();
    }).fail(fail)
      .always(always);
}

function getRouteMasterById(id, done, fail, always) {
    if (parsed && parsed.route_masters[id]) {
        done(parsed.route_masters[id]);
        if (always != null) {
                always();
        }
    } else {
        var base = 'relation["type"="route_master"](' + id + ')';
        updateStatus("dl");
        getRouteMastersData(base, done, fail, always);
    }
}
