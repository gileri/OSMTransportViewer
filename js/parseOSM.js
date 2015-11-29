function haveTag(obj, key, value) {
    if (!obj || ! obj.tags)
        return false;
    if(!value)
        return (key in obj.tags);
    return (obj.tags[key] == value);
}


function parseOSM (data) {
    var nodes = {}
    var ways = {}
    var rels = {}

    var stop_positions = {}
    var platforms = {}
    var stop_areas = {}
    var routes = {}
    var route_masters = {}

    // Add all features to nodes/way/rels according to their type
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


    // Attach nodes to their parent ways
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

    // Attach relation members to their parent relations
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
                    case "stop_entry_only":
                    case "stop_exit_only":
                        r.stop_positions.push(m);
                    break;
                    case "platform":
                    case "platform_entry_only":
                    case "platform_exit_only":
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

    _.each(nodes, function(n) {
        if(haveTag(nodes[n], 'public_transport', 'stop_position')) {
            stop_positions[nodes[n].id] = nodes[n];
        }
        else if (haveTag(nodes[n], 'public_transport', 'platform')) {
            platforms[nodes[n].id] = nodes[n];
        }
    });

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
