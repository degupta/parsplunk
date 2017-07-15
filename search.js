window.currentSearch = {
}

function buildSearch() {
	$('#chartContainerOuter').hide();
	doSearch($("#searchBar")[0].value, window.currentSearch, AGGS, function(data) {
		updateUI(data);
	});

	$("#searchFilters").html(JSON.stringify(window.currentSearch));

	$("#searchBar").keyup(function(event) {
		if(event.keyCode == 13) {
			buildSearch();
		}
	});
}

function doSearch(qry, search, aggs, successFunc, extra) {
	var subQuery = buildQuery(qry, search);

	var dataToSend = {
		'query' : subQuery,
	};

	if (aggs != null) {
		dataToSend.aggs = aggs;
	}

	if (extra != null && extra != undefined) {
		if (extra.size != undefined) {
			dataToSend.size = extra.size;
		}
		if (extra.from != undefined) {
			dataToSend.from = extra.from;
		}
	}


	console.log(JSON.stringify(dataToSend, null, 2));

	jQuery.ajax({
		method:'POST',
		url: 'http://localhost:9200/orders/order/_search',
		data: JSON.stringify(dataToSend),
		success: successFunc,
		error: function(error) {
			console.log(error);
		},
		contentType: "application/json; charset=utf-8"
	});
}

function clearStr(str) {
	return str != null && str != undefined && str != '';
}

function buildQuery(qry, searchObj) {
	var topLevelBool = { bool: { must: [] } };

	if (clearStr(qry)) {
		topLevelBool.bool.must.push({
			"match": {
				"_all" : {
					"query" : qry,
					"operator": "and"
				}
			}
		});
	}

	for (var key in searchObj) {
		// id, ordered_time, cuisine, avg_rating, sla_bad, items
		switch(key) {
			case 'ordered_time':
				break;

			case 'cuisine':
				var cond = {"match":{}}
				cond["match"][key] = searchObj[key]
				topLevelBool.bool.must.push(cond);
				break;

			case 'avg_rating':
				for (var i = 0; i < RANGES[key].length; i++) {
					var range = RANGES[key][i];
					if (range["key"] == searchObj[key]) {
						var cond = {"range":{}};
						cond["range"][key] = {"gte": range["from"], "lt": range["to"] };
						topLevelBool.bool.must.push(cond);
					}
				}
				break;

			case 'items-item_name':
			case 'items-is_enabled':
			case 'items-item_price':
				topLevelBool.bool.must.push(nestedBool("items", key.replace('items-', 'items.'), searchObj[key]));
				break;

			case 'id':
			case 'sla_bad':
			default:
				var cond = {"term":{}};
				cond["term"][key] = searchObj[key];
				topLevelBool.bool.must.push(cond);
		}
	}

	return topLevelBool;
}

function nestedBool(path, term, data) {
	var res = {
		"nested": {
			"path": path,
			"query": {
				"term": {}
			}
		}
	};

	res.nested.query.term[term] = data;
	return res;
}

function updateUI(data) {
	updateOrders(data);

	$("#pageContainter").pagination({
		items: data.hits.total,
		itemsOnPage: 10,
		cssStyle: 'light-theme',
		onPageClick: function(page, event) {
			doSearch($("#searchBar")[0].value, window.currentSearch, null, function(data) {
				updateOrders(data);
			}, {
				from: (page - 1) * 10
			});
		}
	});

	if (data.aggregations) {
		updateAggs(data.aggregations);
	}
}

function updateOrders(data) {
	var mainDiv = $("#rightTab")[0];
	$(mainDiv).empty();
	data.hits.hits.forEach(function(hit) {
		var mapped = hit._source;

		var order = document.createElement("div");
		order.className = 'order';

		for (var key in mapped) {
			// id, ordered_time, cuisine, avg_rating, sla_bad, items
			switch(key) {

				case 'slot':
					$(order).append("<div><b> Slot: " + mapped[key] +"</b></div>");
					break;

				case 'cuisine':
					var cuisines = mapped.cuisine.join(", ");
					$(order).append("<div>Cuisine: " + cuisines +"</div>");
					break;

				case 'avg_rating':
					$(order).append("<div><b>RATING: " + mapped['avg_rating'] + "</b></div>");
					break;

				case 'sla_bad':
					$(order).append("<div><b>SLA BUCKET: " + mapped['sla_bad'] + "</b></div>");
					break;

				case 'items':
					var items = mapped.items.map(function(item) { return item.item_name; }).join(", ");
					$(order).append("<div>ITEMS: " + items +"</div>");
					break;

				case 'customer_location':
				case 'restaurant_location':
					$(order).append("<div> Location: " + mapped[key]['lat'] + ", " +  mapped[key]['lon'] + "</div>");
					break;

				default:
					$(order).append("<div>" + key + ": " + mapped[key] +"</div>");
					break;
			}
		}

		newDiv = document.createElement("div");
		newDiv.style = 'margin:20px';
		newDiv.append(order);
		mainDiv.append(newDiv);
	});
}

function updateAggs(aggs) {
	var mainDiv = $("#leftTab")[0];
	$(mainDiv).empty();

	for (var key in aggs) {
		if (key == 'items-agg') {
			for (var key2 in aggs['items-agg']) {
				if (key2 !== 'doc_count') {
					mainDiv.append(buildBuckets(key2, aggs['items-agg'][key2]));
				}
			}
		} else if (key !== 'doc_count') {
			mainDiv.append(buildBuckets(key, aggs[key]));
		}
	}

	// mainDiv.append(buildBuckets('Teams', aggs.teams));
	// mainDiv.append(buildBuckets('Users', aggs.users.all_users));
	// mainDiv.append(buildBuckets('Roles', aggs.roles.all_roles));
	// mainDiv.append(buildBuckets('Metadata', aggs.metadata.all_metadata));
	// mainDiv.append(buildBuckets('Inputs', aggs.inputs.all_inputs));
	

}

function buildBuckets(name, data) {
	name = name.replace('-agg','');
	var wrapperDiv = document.createElement("div");
	var nameEl = $("<p><b>" + name + "</b></p>");
	$(wrapperDiv).append(nameEl);
	var newDiv = document.createElement("div");
	newDiv.className = 'collapse'

	if (data.buckets == null || data.buckets == undefined || data.buckets.length == 0) {
		$(wrapperDiv).append(newDiv)
		return wrapperDiv;
	}

	$(nameEl).click(function(){
		$(newDiv).collapse('toggle');
	});

	data.buckets.forEach(function(bucket) {
		var elDiv = document.createElement("div");
		elDiv.style = 'margin:15px';
		var link = document.createElement('a');
		link.href = "#"

		$(link).click(function() {
			var build = true;
			// if (name == 'Teams') {
			// 	window.currentSearch.team = bucket.key;
			// } else if (name == 'Users') {
			// 	if (!window.currentSearch.users) window.currentSearch.users = [];
			// 	window.currentSearch.users.push(bucket.key);
			// } else if (name == 'Roles') {
			// 	if (!window.currentSearch.roles) window.currentSearch.roles = [];
			// 	window.currentSearch.roles.push(bucket.key);
			// } else {
			// 	build = false;
			// 	drawHistogram(name, bucket);
			// }

			window.currentSearch[name] = bucket.key;

			if (build) buildSearch();
		})

		link.innerHTML =  bucket.key + " (" + bucket.doc_count + ")";
		$(elDiv).append(link);
		$(newDiv).append(elDiv);
	})
	$(wrapperDiv).append(newDiv)
	return wrapperDiv;
}

function drawHistogram(name, bucket) {
	var newSearch = $.extend(true, {}, window.currentSearch);
	var newAggs   = null;

	if (name == 'Metadata') {
		var newAggs = {metadata: $.extend(true, {}, AGGS.metadata)};
		newSearch.metadata = bucket.key;
		newAggs.metadata.aggs.all_metadata.terms.field = "metadata.value";
	} else {
		var newAggs = {inputs: $.extend(true, {}, AGGS.inputs)};
		newSearch.input = bucket.key;
		newAggs.inputs.aggs.all_inputs.terms.field = "inputData.value";
	}

	doSearch($("#searchBar")[0].value, newSearch, newAggs, function(data) {
		showHistogram(name, bucket, data.aggregations);
	}, {
		size: 0
	});
}

function showHistogram(name, bucket, data) {
	var buckets = name == 'Metadata' ? data.metadata.all_metadata.buckets : data.inputs.all_inputs.buckets;

	$('#chartContainerOuter').show();
	var chart = new CanvasJS.Chart("chartContainer", {
		title: {
			text: name + ": " + bucket.key
		},
		animationEnabled: true,
		animationDuration: 2000,
		data: [{
			type: "column",
			dataPoints: buckets.map(function(bucket) {
				return { y: bucket.doc_count, label: bucket.key };
			}),
			click: function(e) {
				if (name == 'Metadata') {
					if (!window.currentSearch.metadataValues) window.currentSearch.metadataValues = [];
					window.currentSearch.metadataValues.push({name: bucket.key, value: buckets[e.dataPoint.x].key });
				} else {
					if (!window.currentSearch.inputValues) window.currentSearch.inputValues = [];
					window.currentSearch.inputValues.push({name: bucket.key, value: buckets[e.dataPoint.x].key });
				}
				buildSearch();
			}
		}]
	});
	chart.render();
}


var AGGS = {};

SCHEMA = {
    "id": {
        "type": "long"
    },
    "ordered_time" : {
        "type": "date"
    },
    "payment_status": {
        "type": "boolean"
    },
    "customer_id" : {
        "type": "long"
    },
    "customer_location" : {
        "type": "geo_point"
    },
    "customer_hash" : {
        "type": "keyword"
    },
    "customer_user_agent" : {
        "type": "keyword"
    },
    "payment_method" : {
        "type": "keyword"
    },
    "restaurant_id" : {
        "type": "long"
    },
    "restaurant_name" : {
        "type": "keyword"
    },
    "cuisine" : {
        "type": "keyword"
    },
    "area_id" : {
        "type": "integer"
    },
    "city" : {
        "type": "string"
    },
    "restaurant_location" : {
        "type": "geo_point"
    },
    "rest_hash" : {
        "type": "keyword"
    },
    "avg_rating" : {
        "type": "float"
    },
    "area_name" : {
        "type": "keyword"
    },
    "sla_bad": {
        "type": "integer"
    },
    "slot": {
        "type": "keyword"
    },
    "items": {
        "type": "nested",
        "properties": {
            "item_name" : {
                "type": "keyword"
            },
            "is_enabled" : {
                "type": "boolean"
            },
            "item_price" : {
                "type": "float"
            },
            "item_id" : {
                "type": "long"
            },
            "quantity" : {
                "type": "integer"
            }
        }
    }
};

var RANGES = {
	'avg_rating': [
		{ "key" : "Diarrhoea", "from" : 0, "to" : 1 },
		{ "key" : "Bad", "from" : 1, "to" : 2 },
		{ "key" : "Avg", "from" : 2, "to" : 3 },
		{ "key" : "Good", "from" : 3, "to" : 4 },
		{ "key" : "Great", "from" : 4, "to" : 5 },
		{ "key" : "OutOfThisWorld", "from" : 5, "to": 100000 }
	]
};

(function() {
	for (var key in SCHEMA) {
		// id, ordered_time, cuisine, avg_rating, sla_bad, items
		switch(key) {
			case 'id':
				break;


			case 'ordered_time':
				break;

			case 'avg_rating':
				AGGS[key + '-agg'] = {
					"range" : {
						"field" : key,
						"ranges" : RANGES[key]
		            }
				};
				break;

			case 'customer_location':
			case 'restaurant_location':
			case 'area_id':
				break;

			case 'items':
				AGGS[key + "-agg"] = {
					"nested" : {
						"path": "items"
					},
					"aggs": {
						"items-item_name-agg": {
							"terms" : {
								"field": "items.item_name"
							}
						},
						"items-is_enabled-agg": {
							"terms" : {
								"field": "items.is_enabled"
							}
						},
						"items-item_price-agg": {
							"terms" : {
								"field": "items.item_price"
							}
						}
					}
				}
				break;

			default:
				AGGS[key + "-agg"] = {
					"terms": {
						"field": key
					}
				};
		}
	}

})()

// var AGGS = {
// 	"teams": {
// 		"terms" : {
// 			"field": "teamDomain"
// 		}
// 	},

// 	"users": {
// 		"nested" : {
// 			"path": "users"
// 		},
// 		"aggs": {
// 			"all_users": {
// 				"terms" : {
// 					"field": "users.email"
// 				}
// 			}
// 		}
// 	},
	
// 	"roles": {
// 		"nested" : {
// 			"path": "roles"
// 		},
// 		"aggs": {
// 			"all_roles": {
// 				"terms" : {
// 					"field": "roles.name"
// 				}
// 			}
// 		}
// 	},
	
// 	"metadata": {
// 		"nested" : {
// 			"path": "metadata"
// 		},
// 		"aggs": {
// 			"all_metadata": {
// 				"terms" : {
// 					"field": "metadata.name"
// 				}
// 			}
// 		}
// 	},
	
// 	"inputs": {
// 		"nested" : {
// 			"path": "inputData"
// 		},
// 		"aggs": {
// 			"all_inputs": {
// 				"terms" : {
// 					"field": "inputData.name"
// 				}
// 			}
// 		}
// 	}
// };
