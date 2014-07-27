OSMTransportViewer
==================

An OpenStreetMap [Public Transport](https://wiki.openstreetmap.org/wiki/Public_transport) parser and plan renderer.

Parses the "new" [schema](https://wiki.openstreetmap.org/wiki/Proposed_features/Public_Transport) and produces a transport plan in SVG.

# How to use #

Open index.html (a working version is hosted by [Github](https://gileri.github.io/OSMTransportViewer/)),
enter your public transport network name, the reference of the route and you're good !

The simplest way to host it locally (on port 8000 by default) is to run "python3 -m http.server"

The verbose parameter try to highlight stops with errors.
You can change the Overpass API server to whichever you want (some don't have a valid SSL certificate and won't work in HTTPS)

After displaying a route, you can share it with others directly by copying the page's URL, as it updates as soon as you request a new plan.

Have *fun* with Public Transport ! (/s)

# Credits #

Data from [OpenStreetMap](http://www.openstreetmap.org) © OpenStreetMap contributors

Pre-parsing done by the wonderful [Overpass API](http://wiki.openstreetmap.org/wiki/Overpass_API)

Default server for queries [overpass-api.de](http://overpass-api.de/), which I hammered pretty hard during my tests, sorry !

D3.js to generate plan's svg

JQuery
