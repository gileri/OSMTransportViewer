var haveTag = function(obj, key, value) {
    if (!obj || ! obj.tags)
        return false;
    if(!value)
        return (key in obj.tags);
    return (obj.tags[key] === value);
}


var parseOSM = function (data) {
    var nodes = {}
    var ways = {}
    var rels = {}

    var stop_positions = {}
    var platforms = {}
    var stop_areas = {}
    var routes = {}
    var route_masters = {}
    data.elements.forEach(function(e) {
       switch(e.type) {
           case "node":
           nodes[e.id] = e;
       break;
       case "way":
           ways[e.id] = e;
       break;
       case "relation":
           rels[e.id] = e;
       break;
       }
    });

    _.each(ways, function(w) {
        newMembers = [];
        w.nodes.forEach(function(m) {
                newMembers.push(nodes[m]);
        });
        w.nodes = newMembers;
        if (haveTag(w, 'public_transport', 'platform')) {
            platforms[w.id] = w;
        }
    });

    _.each(rels, function(r) {
        newMembers = [];
        _.each(r.members, function(m) {
            var newMember;
           switch(m.type) {
                case "node":
                    newMember = nodes[m.ref];
                break;
                case "way":
                    newMember = ways[m.ref];
                break;
                case "relation":
                    newMember = rels[m.ref];
                break;
            }
            if(newMember) {
                newMember.role = m.role;
                newMembers.push(newMember);
            }
        });
        r.members = newMembers;
        if(haveTag(r, 'type', 'public_transport')
        && haveTag(r, 'public_transport', 'stop_area')) {
            stop_areas[r.id] = r;
            _.each(r.members, function(member) {
                // TODO Reference Stop_area into member nodes
                member.stop_area = r;
            });
        }
        else if (haveTag(r, 'type', 'route')) {
            routes[r.id] = r;
            r.stop_positions = [];
            r.platforms = [];
            r.paths = [];
            _.each(r.members, function(m) {
                switch(m.role) {
                    case "stop":
                        r.stop_positions.push(m);
                    break;
                    case "platform":
                        r.platforms.push(m);
                    break;
                    case "":
                    case "forward":
                    case "backward":
                        r.paths.push(m);
                    break;
                }
            });
        }
        else if (haveTag(r, 'type', 'route_master')) {
            route_masters[r.id] = r;
        }
    });

    for (var n in nodes) {
        if (!nodes.hasOwnProperty(n)) {
            continue;
        }
        if(haveTag(nodes[n], 'public_transport', 'stop_position')) {
            stop_positions[nodes[n].id] = nodes[n];
        }
        else if (haveTag(nodes[n], 'public_transport', 'platform')) {
            platforms[nodes[n].id] = nodes[n];
        }
    }

    return {
        'nodes': nodes,
        'ways': ways,
        'rels': rels,
        'stop_positions': stop_positions,
        'platforms': platforms,
        'stop_areas': stop_areas,
        'routes': routes,
        'route_masters': route_masters
    }
}
