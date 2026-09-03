// What each layer is, said once, in the popup.
//
// The map used to answer a click with the feature's raw spreadsheet columns and
// nothing else. That tells you what was recorded and never what you are looking
// at — "HOLDING AREA 60" with an area in square metres does not say whether it
// is a crowd ground or a car park, and "geocodeConfidence: LOW" does not say who
// graded it or against what.
//
// Every entry was written from the layer's own fields and the build script that
// produced it, then fact-checked against both by a second reader whose job was
// to refute it. That pass rewrote 31 of the 36 — it caught the ghats
// layer being described as following the KMZ's folders when it is the one layer
// that does not, the ring road being called a stretch of road when all eight
// features are closed loops, and a parking merge described as adding polygons
// when it also replaced the geometry of an existing zone. The corrected text is
// what ships. Where the repo does not know something, these say so.
//
// summary    what a single feature IS
// provenance where the data came from
// caveat     what the whole layer will mislead you about, if anything. Distinct
//            from the per-feature confidence badge in ./confidence, which is
//            about one point rather than the dataset. 36 of 36 carry one.
// fieldNotes readable labels for the raw property keys; the popup keeps the raw
//            key on hover so a reader can still match it to a downloaded CSV.
export type LayerInfo = {
  summary: string;
  provenance: string;
  caveat?: string;
  fieldNotes?: Record<string, string>;
};

export const LAYER_INFO: Record<string, LayerInfo> = {
  'ghats': {
    summary: "A polygon marking a bathing ghat or a riverside crowd holding area in the Kumbh mobility plan, or the centroid point repeating it.",
    provenance: "From the NTKMA \"Mobility plan Nashik\" KMZ, assembled by scripts/build-mobility.mjs. Unlike the other layers it does not follow the KMZ's folders: the two named ghats sit in the Railway station and VIP routes folders, and the rest were lifted out of Holding Areas by measuring against the river.",
    caveat: "40 features are 20 areas each doubled as a centroid marker. Only 2 of those areas are named ghats; the other 18 come from the KMZ Holding Areas tree, kept because their nearest edge falls within 150 m of an OpenStreetMap river line, and are tagged riverside-holding, not ghat. Three more inside that distance were excluded by hand as parking or a station.",
    fieldNotes: {
      category: "Ghat Or Holding Area",
      source: "Source File",
      sourceFolder: "KMZ Folder Path",
    },
  },
  'parking-zones': {
    summary: "The outline of one plot the Kumbh plan sets aside for parking, tagged inner or outer as the source KMZ had it.",
    provenance: "32 zones from the NTKMA parking KMZ, with 20 outer-parking polygons appended from the NTKMA mobility-plan KMZ by scripts/build-mobility.mjs, which also replaced the geometry of one inner zone, Near Dive Bungalow.",
    caveat: "Capacity and area figures exist on only 5 of the 52 zones, parsed from the mobility plan's own Google Earth balloons — a blank means no figure was given, not zero; the zeros that do appear are the plan's own.",
    fieldNotes: {
      Area: "Area (Hectares)",
      Area_Acer: "Area (Acer Field)",
      Bavik_Gram: "Bavik Gram",
      Bus_Parking: "Bus Parking Capacity",
      category: "Feature Category",
      Clock_room_15x20m: "Clock Rooms 15x20m",
      description: "Source Description",
      InOut: "Source In/Out Flag",
      Motor_Vehicle: "Motor Vehicle Capacity",
      Name_Road: "Approach Road",
      Nivara_Shed_20x25m: "Nivara Sheds 20x25m",
      source: "Source Dataset",
      sourceFolder: "Source Folder Path",
      Stall_4x3m: "Stalls 4x3m",
      Two_Wheeler: "Two-Wheeler Capacity",
      zone: "Inner Or Outer",
    },
  },
  'ring-road': {
    summary: "One of the eight lines the NTKMA master KML names Official Ring Road Segment 1 to 8. The name is all the source says about it.",
    provenance: "Split out of the NTKMA master KML by scripts/build-datasets.mjs, which keeps every placemark whose name starts with \"Official Ring Road Segment\" and asserts the count is 8.",
    caveat: "Each of the eight segments is drawn as a closed line that ends on its own start point, so what you see is a loop, not an open run of road. Nothing here checks these lines against a road on the ground.",
    fieldNotes: {
      category: "Feature Category",
    },
  },
  'congestion-points': {
    summary: "One site outlined in the NTKMA master KML — transit hub, chowk, market or water body — drawn twice: as a footprint and as a centre dot.",
    provenance: "Polygons left in the NTKMA master KML after ghats and parking duplicates were removed, split out by scripts/build-datasets.mjs.",
    caveat: "\"Congestion\" is the build script's own label, not a field read from the KML — build-datasets.mjs tags whatever polygons were left, and two of the eight (Gandhi Talav and Gandhi Talav 2, 64 m apart) it tags landmark instead. Nothing in the data measures crowding, and the 16 features are those 8 polygons drawn twice: outline plus centre dot.",
    fieldNotes: {
      category: "Site Type",
    },
  },
  'cctv-cameras': {
    summary: "One CCTV camera position. Labels come in two forms: Z<zone>-C<camera> (Z1-C1), or a plain running number in one of four series — C-0001, M-001, RRC 1, G-001.",
    provenance: "Split out of the NTKMA master KML by scripts/build-datasets.mjs, which takes every point placemark in that file as a camera.",
    caveat: "Zone is parsed off the label and only exists for the Z<n>-C<m> names — 1,280 of the 4,079 cameras, 32 zones of 40 each. The other 2,799 are numbered C-, M-, RRC- and G-, series that carry no zone at all, so a blank zone means the label never named one. Whether those cameras sit inside a zone is not recorded anywhere.",
    fieldNotes: {
      zone: "Camera Zone",
    },
  },
  'mandirs': {
    summary: "One religious site in Nashik or Trimbakeshwar taluka — a temple, ashram, tirtha or other place of worship — with its Google Maps listing.",
    provenance: "No build script here produces it: the layer ships as GeoJSON in public/data, each row carrying a Google Maps place link and a review count, most of them a rating too.",
    caveat: "Rating, review count and opening hours are Google Maps listing fields: hours are on only 366 of the 1,089 sites and a rating on 1,022 — the 67 without one are exactly the 67 with no reviews. A blank field is missing data, not a shut temple, and no confidence grade ships with these coordinates.",
    fieldNotes: {
      Address: "Postal Address",
      Category: "Site Category",
      "Maps Link": "Google Maps Link",
      "Opening Hours": "Opening Hours",
      Phone: "Phone Number",
      Rating: "Google Rating",
      "Review Count": "Google Review Count",
      Taluka: "Taluka (Sub-District)",
      Type: "Listing Type",
      Website: "Website Link",
      Zone: "City Zone",
    },
  },
  'staging-areas': {
    summary: "A point marking one site the mobility plan lists as a staging area. Where the plan gives a description it names a stadium, parade ground, bus stand, school or municipal premises; the rest carry only a name, such as a road junction or a survey number.",
    provenance: "Split out of the NTKMA \"Mobility plan Nashik\" KMZ by scripts/build-mobility.mjs, following the administrator's own folder names.",
    caveat: "Each site is a single point, not a boundary, so its extent is not in the data. 2 of the 13 carry no name, only a description, and 4 carry no description, only a name.",
    fieldNotes: {
      description: "Premises Or Address",
      source: "Source Dataset",
      sourceFolder: "KMZ Folder Path",
    },
  },
  'holding-areas': {
    summary: "One ground the NTKMA mobility plan sets aside for holding crowds, most of them listed in the source under a road such as Mumbai road or Pune road.",
    provenance: "Built by scripts/build-mobility.mjs from the 'Holding Areas' folder of the NTKMA Mobility plan Nashik KMZ, a Google Earth Pro export.",
    caveat: "The 60 features are 30 grounds counted twice, a polygon and its vertex-mean centre dot, and 18 riverside holding grounds from the same folder ship in the ghats layer instead.",
    fieldNotes: {
      source: "Source File",
      sourceFolder: "KMZ Folder Path",
    },
  },
  'railway-station': {
    summary: "One piece of the NTKMA mobility plan, drawn in one of the six folders under \"Railway station\": a station or platform outline, a holding area, a drop or pickup point, a bus stand, a pedestrian path or bus route, or a distance measurement.",
    provenance: "Split from the \"Railway station\" folder of the NTKMA \"Mobility plan Nashik\" KMZ by scripts/build-mobility.mjs; 3 of 89 placemarks had no usable ring.",
    caveat: "Names are not identifiers: 86 features carry 65 distinct names, 11 of them repeated across 32 features, and 15 features are titled only \"Untitled\". sourceFolder is the one thing separating one \"ODHA RAILWAY STATION\" from another — and three same-name pairs are the identical shape drawn in two folders, so a repeated name is sometimes a duplicate rather than a second place.",
    fieldNotes: {
      source: "Source Document",
      sourceFolder: "Source Folder Path",
    },
  },
  'vip-routes': {
    summary: "A corridor drawn in the administrator's mobility plan for VIP movement between named places — a rest house, the MITRA office, Takli Sangam ghat.",
    provenance: "From the NTKMA \"Mobility plan Nashik\" KMZ; scripts/build-mobility.mjs splits out the placemarks under its Routes / VIP routes folder.",
    caveat: "Three of the 19 features are single points, not routes, and the line colours are the KMZ's own with no record of which route class each colour marks.",
    fieldNotes: {
      source: "Source File",
      sourceFolder: "KMZ Folder Path",
    },
  },
  'emergency-routes': {
    summary: "An emergency route between a ghat and a hospital in the administrator's mobility plan — most are named for the hospital they run to — or one of the hospital markers filed alongside them.",
    provenance: "Split from the NTKMA \"Mobility plan Nashik\" KMZ by scripts/build-mobility.mjs, following the administrator's own \"Routes / Emergency routes\" folder.",
    caveat: "The 67 features are 38 route lines plus 29 hospital markers, not 67 routes, and the markers carry only 17 distinct names — the same hospital reappears in several ghat folders. Which ghat a route serves is usually only in sourceFolder, not in the feature name.",
    fieldNotes: {
      source: "Source File",
      sourceFolder: "Folder Path In KMZ",
    },
  },
  'movement-routes': {
    summary: "One of the 40 lines the mobility plan draws under Routes / Movement — bus, pedestrian, entry/exit and parking-to-ghat corridors — filed under one of eight approach roads (Pune, Mumbai, Dindori, Dhule, Ch. Sambhajinagar, Trimbakeshwar, Gangapur, Peth).",
    provenance: "From the NTKMA \"Mobility plan Nashik\" KMZ, split along the administrator's own folders by scripts/build-mobility.mjs; the raw KMZ is not in the repo.",
    caveat: "Names are uneven: 11 of the 40 lines arrive as \"Untitled Path\", and two are named \"... parking distance\" rather than as a route. All of them are drawn from a plan, not from observed traffic.",
    fieldNotes: {
      description: "Route Description",
      source: "Source File",
      sourceFolder: "Source Folder Path",
    },
  },
  'bus-depots': {
    summary: "One of the two depots Nashik's Citilinc city bus service runs from, with its fleet numbers and the stops assigned to it.",
    provenance: "Read off the NMPML (Citilinc) RTI reply 3120/2026 of 17 Aug 2026 by hand: position from the stop table, fleet numbers from page 1.",
    caveat: "The depot coordinate is that depot's own geofenced bus stop, so both points also appear among the 1,854 features in the Bus stops layer.",
    fieldNotes: {
      buses: "Total Buses",
      cngBuses: "CNG Buses",
      dieselBuses: "Diesel Buses",
      electricBuses: "Electric Buses",
      stopsServed: "Stops Assigned",
    },
  },
  'bus-stops': {
    summary: "One Citilinc city bus stop, plotted at the centre of the geofence the operator's own tracking system holds for it.",
    provenance: "Transcribed from the NMPML (Citilinc) RTI reply 3120/2026 of 17 August 2026 and built by scripts/build-citilink.mjs.",
    caveat: "The up or down side is only recorded where the source name ends in (U) or (D) — 910 of 1,854 stops — so a blank side does not mean the stop is single-sided.",
    fieldNotes: {
      depot: "Depot Name",
      side: "Side Of Road",
    },
  },
  'hospitals': {
    summary: "One privately owned medical facility in Nashik — hospital, maternity or specialist — with its owner and listed address, plus registered beds and a phone number where the source recorded them.",
    provenance: "Arrived with the project's initial import, already geocoded and graded; no build script in this repo produces it and the upstream source is not recorded.",
    caveat: "None of the three grades is a surveyed position: what they mean upstream is recorded nowhere, and even HIGH shares its coordinate with other hospitals 35% of the time.",
    fieldNotes: {
      address: "Listed Address",
      category: "Ownership Category",
      facilityType: "Facility Type",
      owner: "Owner Name",
      phone: "Phone Number",
      registeredBeds: "Registered Beds",
    },
  },
  'police-stations': {
    summary: "One police facility in Nashik taluka — a station, a chowky or outpost, a women's police station, or the Commissionerate headquarters.",
    provenance: "No build script in this repo produces it: the layer ships as prepared GeoJSON, each of the 71 stations carrying an address and a Google Maps place link.",
    caveat: "\"Open Now\" is a value fixed in the file, present on 32 of the 71 stations — the map is static and has no backend, so it is not a live status.",
    fieldNotes: {
      Address: "Postal Address",
      Category: "Police Post Type",
      Email: "Email Address",
      "Maps Link": "Google Maps Link",
      "Open Now": "Recorded Open Status",
      Phone: "Phone Number",
      Rating: "Google Star Rating",
      "Review Count": "Google Review Count",
      Taluka: "Taluka (Sub-District)",
      Type: "Google Listing Category",
      Website: "Official Website",
      Zone: "City Zone",
    },
  },
  'ambulances': {
    summary: "A contact listed under ambulance services in the Nashik area, with a name, address and rating. Only 31 of the 79 names read as ambulance operators; most of the rest are hospitals and clinics. It is a listing, not a vehicle on the road.",
    provenance: "From one of the 12 \"kumbhdoot\" source sheets, which carried no coordinates, so the point was placed from its address text. The rating came with the sheet; no script in this repo builds this layer, and nothing records where the rating is from.",
    caveat: "No point here is a real coordinate: 50 sit on a locality centroid plus jitter matched from the address, and 29 near the city centre because no match was found. None has been verified against an independent source.",
    fieldNotes: {
      Address: "Listed Address",
      Rating: "Listed Rating",
    },
  },
  'fire-stations': {
    summary: "One dot is one fire-related entry from the source sheet — a fire station or a fire-safety firm — with its name, address and a rating.",
    provenance: "One of the 12 \"kumbhdoot\" source sheets, which carried no coordinates — names and addresses, plus a rating whose origin is recorded nowhere. No build script in this repo produces this layer.",
    caveat: "Not the city's fire brigade roster — ten mixed entries, and nothing in the file records ownership: only one name, Nmc Fire Rescue Station, says municipal at all. None sits on a surveyed coordinate — nine are locality-match, and the NMC one is \"approximate\", placed near the city centre because even a locality match failed.",
    fieldNotes: {
      Address: "Address",
      Rating: "Rating",
    },
  },
  'blood-banks': {
    summary: "One blood bank or blood centre in the Nashik area, with its listed name and address. 14 of the 19 also carry a category — private, hospital-attached or government.",
    provenance: "Arrived with the initial import; no build script here produces it. 14 of the 19 rows carry a Google Maps place link along with the directory fields that come with it — rating, review count, zone, taluka — and the other five hold only a name, an address and a coordinate-confidence flag.",
    caveat: "\"Blood Type\" is a directory label, not the groups a bank holds — the only values are \"Blood Banks\" and \"Fresh Frozen Plasma Blood Banks\" — and nothing here records stock. Five of the 19 points have no real coordinate: two are locality-match, placed by matching the address text to a locality centroid, and three are approximate, put near the city centre when even that failed.",
    fieldNotes: {
      Address: "Street Address",
      "Blood Type": "Directory Listing Category",
      Category: "Ownership Category",
      "Maps Link": "Google Maps Link",
      Phone: "Phone Number",
      Rating: "Listed Star Rating",
      "Review Count": "Number Of Reviews",
      Taluka: "Taluka (Sub-District)",
      Type: "Listing Type",
      Zone: "City Zone",
    },
  },
  'diagnostic-labs': {
    summary: "A diagnostic business listed in Nashik — the Category field runs from imaging and radiology to ultrasonography and prenatal check-up. Of the ten rows, two are categorised as hospitals and one as a dental clinic.",
    provenance: "Arrived with the initial import, carrying the locality-match vocabulary the repo attributes to the 12 \"kumbhdoot\" sheets, which came with no coordinates; no script in this repo builds this layer.",
    caveat: "No position here is surveyed: eight points were placed from the locality named in the address, two near the city centre when even that failed.",
    fieldNotes: {
      Address: "Listed Address",
      Category: "Service Category",
      Phone: "Phone Number",
      Rating: "Listed Rating",
    },
  },
  'public-toilets': {
    summary: "One public sanitation facility in Nashik — a community toilet, public toilet, Sulabh toilet, urinal or Sulabh community toilet.",
    provenance: "Committed GeoJSON that no script in this repo builds. It arrived with the initial commit, and nothing here records where it came from or how the points were placed.",
    caveat: "These points carry no confidence grade at all — the file holds only a name and a facility type, so nothing says whether a position is surveyed or a locality guess, and no script here checks them against an independent source.",
    fieldNotes: {
      facilityType: "Facility Type",
    },
  },
  'petrol-pumps': {
    summary: "A petrol pump in the Nashik area, carrying the name and address its source sheet listed, plus a rating.",
    provenance: "From the 12 \"kumbhdoot\" source sheets, which the README records as carrying names and addresses only — no coordinates. No build script in this repo produces this layer, and nothing in the repo says where the rating (3.3–4.8 here) came from or what it measures.",
    caveat: "Not one of the 87 has a surveyed position — 42 placed by locality name from the address, 45 near the city centre — so a dot marks an area, not a forecourt.",
    fieldNotes: {
      Address: "Listed Address",
      Rating: "Rating From Source",
    },
  },
  'car-service-centers': {
    summary: "One car repair, servicing or towing business in and around Nashik, listed by the name and address it appeared under.",
    provenance: "From the 12 \"kumbhdoot\" source sheets, which carried names and addresses only; the position was placed by this repo's own pipeline, not taken from the sheet.",
    caveat: "No dot here is a surveyed position: 57 were placed from a locality name in the address, and 40 near the city centre when even that failed.",
    fieldNotes: {
      Address: "Listed Address",
    },
  },
  'two-wheeler-service': {
    summary: "A two-wheeler repair shop or dealership listed in the Nashik area, with the name, address and service tags its source sheet carried.",
    provenance: "One of the 12 \"kumbhdoot\" source sheets, which carried no coordinates — the point was placed from the address text; no build script in this repo produces this layer.",
    caveat: "None of these 95 points is a surveyed position: 57 were placed from the locality in the address and 38 near the city centre, so a dot marks a neighbourhood, not the shop.",
    fieldNotes: {
      Address: "Listed Address",
      Authorized: "Dealer Or Service Tag",
      Phone: "Phone Number",
      Type: "Additional Service Tag",
    },
  },
  'waste-routes': {
    summary: "One municipal waste vehicle's planned collection round, drawn as a line and named by the vehicle's registration plate.",
    provenance: "From the default_route.json files in the NMC waste collection vehicle tracking export for 30 August 2026, obtained by RTI.",
    caveat: "This is the planned round as the operator's system holds it, not the track the vehicle drove — the raw GPS fixes are deliberately not published here. That the fleet is waste collection comes from the person who filed the RTI; nothing in the export itself names the service.",
    fieldNotes: {
      points: "Path Vertex Count",
      routeId: "Operator Route Id",
    },
  },
  'waste-zones': {
    summary: "Each polygon is the geofenced service area of one municipal waste collection vehicle's round, labelled with the vehicle's registration plate.",
    provenance: "Built by scripts/build-waste-fleet.mjs from the route_polygon files of an NMC waste collection vehicle tracking RTI export, 30 August 2026.",
    caveat: "These areas overlap rather than tile: sampled on a grid, a covered point sits inside 10 zones at the median and 21 at the worst, so a zone is not an exclusive boundary.",
    fieldNotes: {
      routeId: "Route ID",
    },
  },
  'waste-checkpoints': {
    summary: "One named timing point on a municipal waste collection vehicle's round, with the time it was expected there and the time it actually reached, on 30 August 2026.",
    provenance: "Built by scripts/build-waste-fleet.mjs from the checkpoints.json files in an NMC vehicle tracking RTI export covering a single day, 30 August 2026.",
    caveat: "The deviation is plain subtraction against a nominal :00/:30 slot rather than a timetable, so it is a spread, not a punctuality score. And 325 of these points sit in a vehicle folder whose own route name gives a different plate — both are kept, because the reply does not say which is right.",
    fieldNotes: {
      actualReachTime: "Actual Arrival Time",
      areaCode: "Trailing Area Code",
      deviationMinutes: "Minutes From Slot",
      expectedTime: "Nominal Arrival Slot",
      routeLabel: "Route Name In Export",
      routeNumber: "Route Number",
      vehicle: "Vehicle Plate (Folder)",
      ward: "Ward Number",
    },
  },
  'hotels': {
    summary: "46 hotels in and around Nashik, carried in their source sheet as a name and a postal address and nothing else.",
    provenance: "One of the 12 \"kumbhdoot\" source sheets, which held names and addresses only; no build script in this repo produces this layer.",
    caveat: "None of the 46 has a real coordinate: 40 were placed by locality name from the address and 6 near the city centre, so read a dot as a neighbourhood, not a building.",
    fieldNotes: {
      Address: "Listed Address",
    },
  },
  'guest-houses': {
    summary: "One place to stay as the source's own Category field files it — lodge or hostel (107 of 214), the catch-all \"Other Budget Lodging\" (53), guest house (45), government or PWD rest house (5), ashram stay (3), dharamshala (1) — in one of eight talukas, from Nashik itself out to Trimbakeshwar, Igatpuri, Niphad, Sinnar, Yeola, Dindori and Peth.",
    provenance: "Arrived with the initial commit — no build script in this repo produces it — and every one of the 214 entries carries a Google Maps place link and its own distinct coordinate. None carries a locationConfidence value, so no accuracy badge appears and nothing here records how those positions were fixed.",
    caveat: "Tier 1/2/3 comes through from the source and nothing in the repo says what it ranks; what it measurably tracks is geography, not the places — all 145 Tier 1 entries are the Nashik-taluka ones, and no Nashik entry is Tier 2 or 3. \"Guest house\" is the sheet's framing as well: Google's own Type field reads Hotel on 77 of the 214, and Quality Inn Regency sits in the Hotels layer too.",
    fieldNotes: {
      Address: "Postal Address",
      Category: "Lodging Category",
      "Maps Link": "Google Maps Listing",
      "Opening Hours": "Weekly Opening Hours",
      Phone: "Phone Number",
      "Price Level": "Stated Price Level",
      Rating: "Average Rating",
      "Review Count": "Number Of Reviews",
      Taluka: "Taluka (Sub-District)",
      Tier: "Unexplained Tier Code",
      Type: "Listing Type",
      Website: "Website Link",
      Zone: "City Zone",
    },
  },
  'boys-hostels': {
    summary: "87 boys' hostels in Nashik, each carrying the name and address the source listed, and a phone number on 14 of them.",
    provenance: "One of the \"kumbhdoot\" source sheets, which listed names and addresses but no coordinates; no build script in this repo produces this layer.",
    caveat: "No point here is a surveyed position: 44 were placed from address text onto a locality centroid plus jitter, and 43 near the city centre when even that failed.",
    fieldNotes: {
      Address: "Address As Listed",
      Phone: "Phone Number",
    },
  },
  'girls-hostels': {
    summary: "A hostel or paying-guest lodging listed under girls' accommodation in Nashik, with its name, address and sometimes a phone number.",
    provenance: "From the \"kumbhdoot\" source sheets that came with the initial import, which carried addresses but no coordinates; no build script in this repo produces it.",
    caveat: "No point here is a real coordinate: 16 were placed from the locality named in the address and 7 near the city centre, so read each dot as a neighbourhood, not a building.",
    fieldNotes: {
      Address: "Listed Address",
      Phone: "Phone Number",
    },
  },
  'grocery-shops': {
    summary: "One grocery shop in Nashik or Trimbakeshwar taluka — a kirana or general store, a wholesale provision store, or one filed simply as another grocery shop — with its address, and a phone number where the row has one.",
    provenance: "No build script produces this layer: it shipped as GeoJSON in the repo's first commit, every row carrying a Google Maps place link and a review count, and 664 of the 745 a rating.",
    caveat: "No point here carries a confidence grade, and no script in the repo records how these coordinates were placed, so nothing states how close a dot is to the shop.",
    fieldNotes: {
      Address: "Street Address",
      Category: "Shop Category",
      "Maps Link": "Google Maps Link",
      Phone: "Phone Number",
      Rating: "Listing Rating",
      "Review Count": "Listing Review Count",
      Taluka: "Taluka (Sub-District)",
      Type: "Listing Type",
      Website: "Website Or Social Link",
      Zone: "City Zone",
    },
  },
  'vegetable-markets': {
    summary: "One produce market at a single point. Category splits the 94 into vegetable bazaars (44), a catch-all \"Other Produce Market\" (40), APMC wholesale yards (5), bhaji mandais (3) and farmers markets (2).",
    provenance: "Checked into public/data as GeoJSON with no build script behind it; every feature carries a Google Maps place link and a review count, and 80 of the 94 also carry a rating.",
    caveat: "Tier is undocumented: all 78 Tier 1 markets sit in Nashik taluka and all 16 Tier 2 outside it, but nothing in the repo says what the grade means.",
    fieldNotes: {
      Address: "Postal Address",
      Category: "Market Category",
      "Maps Link": "Google Maps Link",
      "Opening Hours": "Opening Hours",
      Phone: "Phone Number",
      Rating: "Average Rating",
      "Review Count": "Number Of Reviews",
      Taluka: "Taluka (Sub-District)",
      Tier: "Tier Grade",
      Type: "Listing Type",
      Website: "Website Link",
      Zone: "City Zone",
    },
  },
  'cloud-kitchens': {
    summary: "A kitchen cooking for delivery orders, listed on Zomato, Swiggy, Justdial or a similar platform.",
    provenance: "Food-delivery and directory listings (Zomato, Swiggy, Justdial, magicpin, District), imported with one of the 12 \"kumbhdoot\" name-and-address sheets.",
    caveat: "None of the 21 has a real coordinate: 11 sit near a locality centroid taken from the address text, and the other 10 near the city centre because even that failed — so a dot is a neighbourhood at best.",
    fieldNotes: {
      Address: "Listed Address",
      Rating: "Delivery App Rating",
      Source: "Listing Source",
      "Working Hours": "Meals Served",
    },
  },
  'malls': {
    summary: "A shopping mall or shopping centre in Nashik, listed with its address, opening hours and what it is known for.",
    provenance: "One of the 12 \"kumbhdoot\" source sheets, which held names and addresses but no coordinates; two points were later corrected against OpenStreetMap.",
    caveat: "Nine of the eleven dots are still guesses — eight placed by matching address text to a locality centre, one placed near the city centre because even that failed. City Centre Mall sat 688 m off until it was corrected.",
    fieldNotes: {
      Address: "Street Address",
      "Known For": "Known For",
      Timings: "Opening Hours",
    },
  },
  'watch-stores': {
    summary: "Ten watch and clock shops in Nashik, each listed with its address, a rating and the number of ratings behind it.",
    provenance: "One of the 12 \"kumbhdoot\" source sheets, which carried no coordinates; no build script in this repo produces the layer.",
    caveat: "No position here is surveyed: 6 shops were placed by locality name from their address and 4 near the city centre, so read a dot as an area.",
    fieldNotes: {
      Address: "Address As Listed",
      Rating: "Star Rating",
      "Review Count": "Rating Count",
    },
  },
};
