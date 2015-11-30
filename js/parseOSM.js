function haveTag(obj, key, value) {
    if (!obj || ! obj.tags)
        return false;
    if(!value)
        return (key in obj.tags);
    return (obj.tags[key] == value);
}


function parseOSM (data, previous) {
    if(previous !== undefined) {
        var d = previous;
    } else {
        var d = {}
        d.nodes = {}
        d.ways = {}
        d.rels = {}

        d.stop_positions = {}
        d.platforms = {}
        d.stop_areas = {}
        d.routes = {}
        d.route_masters = {}
    }

    // Add all features to nodes/way/rels according to their type
    data.elements.forEach(function(e) {
       switch(e.type) {
           case "node":
           d.nodes[e.id] = e;
       break;
       case "way":
           d.ways[e.id] = e;
       break;
       case "relation":
           d.rels[e.id] = e;
       break;
       }
    });


    // Attach nodes to their parent ways
    _.each(d.ways, function(w) {
        newMembers = [];
        w.nodes.forEach(function(m) {
                newMembers.push(d.nodes[m]);
        });
        w.nodes = newMembers;
        
        if (haveTag(w, 'public_transport', 'platform')) {
            d.platforms[w.id] = w;
        }
    });

    // Attach relation members to their parent relations
    _.each(d.rels, function(r) {
        newMembers = [];
        _.each(r.members, function(m) {
           var newMember;
           switch(m.type) {
                case "node":
                    newMember = d.nodes[m.ref];
                break;
                case "way":
                    newMember = d.ways[m.ref];
                break;
                case "relation":
                    newMember = d.rels[m.ref];
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
            d.stop_areas[r.id] = r;
            _.each(r.members, function(member) {
                member.stop_area = r;
            });
        }
        else if (haveTag(r, 'type', 'route')) {
            d.routes[r.id] = r;
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
            d.route_masters[r.id] = r;
        }
    });

    _.each(d.nodes, function(n) {
        if(haveTag(d.nodes[n], 'public_transport', 'stop_position')) {
            d.stop_positions[d.nodes[n].id] = d.nodes[n];
        }
        else if (haveTag(d.nodes[n], 'public_transport', 'platform')) {
            d.platforms[d.nodes[n].id] = d.nodes[n];
        }
    });

    return d;
}
