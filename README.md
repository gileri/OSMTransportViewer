OSMTransportViewer
==================

An [OpenStreetMap](//openstreetmap.org) [Public Transport](//wiki.openstreetmap.org/wiki/Public_transport) parser and plan renderer based on the "new" [Public Transport schema](//wiki.openstreetmap.org/wiki/Proposed_features/Public_Transport)

# How to use #


1. Go to https://gileri.github.io/OSMTransportViewer
2. Enter either the `network=\*`, `operator=\*` or both
3. Enter the reference (`ref=\*`) of the wanted route 
4. Click on Download
5. Select a route variant in the sidebar

After displaying a route, the URL can be used to share the route query.

Have *fun* with Public Transport !

# Examples #

[TCL C1 in Lyon, France](http://gileri.github.io/OSMTransportViewer/?network=TCL&operator=&ref=C1)
[TAG A in Grenoble, France](http://localhost:8000/?network=&operator=TAG&ref=A)

# Credits #

Data from [OpenStreetMap](http://www.openstreetmap.org) © OpenStreetMap contributors

Data filtering thanks to [Overpass API](http://wiki.openstreetmap.org/wiki/Overpass_API) (default server : [overpass-api.de](http://overpass-api.de/))

jQuery

Leaflet
