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
		url: 'http://10.100.1.59:9200/jobs/job/_search',
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

	if (clearStr(searchObj.team)) {
		topLevelBool.bool.must.push({
			"term": {
				"teamDomain" : searchObj.team
			}
		});
	}

	var users = searchObj.users;
	if (users != undefined && users != null) {
		users.forEach(function (user) {
			topLevelBool.bool.must.push(nestedBool("users", "users.email", user));
		});
	}

	var roles = searchObj.roles;
	if (roles != undefined && roles != null) {
		roles.forEach(function (role) {
			topLevelBool.bool.must.push(nestedBool("roles", "roles.name", role));
		});
	}

	var metadata = searchObj.metadata;
	if (metadata != undefined && metadata != null) {
		topLevelBool.bool.must.push(nestedBool("metadata", "metadata.name", metadata));
	}

	var input = searchObj.input;
	if (input != undefined && input != null) {
		topLevelBool.bool.must.push(nestedBool("inputData", "inputData.name", input));
	}

	var metadataValues = searchObj.metadataValues;
	if (metadataValues != undefined && metadataValues != null) {
		var metaBool = { bool: { must: [] } };

		metadataValues.forEach(function(val) {
			metaBool.bool.must.push(nestedBool("metadata", "metadata.name", val.name));
			metaBool.bool.must.push(nestedBool("metadata", "metadata.value", val.value));
		});

		topLevelBool.bool.must.push(metaBool);
	}

	var inputValues = searchObj.inputValues;
	if (inputValues != undefined && inputValues != null) {
		var inputBool = { bool: { must: [] } };

		inputValues.forEach(function(val) {
			inputBool.bool.must.push(nestedBool("inputData", "inputData.name", val.name));
			inputBool.bool.must.push(nestedBool("inputData", "inputData.value", val.value));
		});

		topLevelBool.bool.must.push(inputBool);
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
	updateJobs(data);

	$("#pageContainter").pagination({
		items: data.hits.total,
		itemsOnPage: 10,
		cssStyle: 'light-theme',
		onPageClick: function(page, event) {
			doSearch($("#searchBar")[0].value, window.currentSearch, null, function(data) {
				updateJobs(data);
			}, {
				from: (page - 1) * 10
			});
		}
	});

	if (data.aggregations) {
		updateAggs(data.aggregations);
	}
}

function updateJobs(data) {
	var mainDiv = $("#rightTab")[0];
	$(mainDiv).empty();
	data.hits.hits.forEach(function(hit) {
		var mapped = hit._source;

		var job = document.createElement("div");
		job.className = 'job';

		$(job).append("<div><b>" + mapped.title + "</b> - " + mapped.teamDomain + "</div></div>");

		if (mapped.roles) {
			var roles = mapped.roles.map(function(role) { return role.name; }).join(", ");
			$(job).append("<div>" + roles.substr(0, 100) + "</div>");
		}

		if (mapped.users) {
			var users = mapped.users.map(function(user) { return user.email; }).join(", ");
			$(job).append("<div>" + users.substr(0, 100) + "</div>");		
		}

		if (mapped.metadata) {
			var metadata = mapped.metadata.map(function(m) { return m.name + ": " + m.value }).join(", ");
			$(job).append("<div>" + metadata.substr(0, 100) + "</div>");		
		}

		if (mapped.inputData) {
			var inputData = mapped.inputData.map(function(m) { return m.name + ": " + m.value }).join(", ");
			$(job).append("<div>" + inputData.substr(0, 100) + "</div>");		
		}

		newDiv = document.createElement("div");
		newDiv.style = 'margin:20px';
		newDiv.append(job);
		mainDiv.append(newDiv);
	});
}

function updateAggs(aggs) {
	var mainDiv = $("#leftTab")[0];
	$(mainDiv).empty();

	mainDiv.append(buildBuckets('Teams', aggs.teams));
	mainDiv.append(buildBuckets('Users', aggs.users.all_users));
	mainDiv.append(buildBuckets('Roles', aggs.roles.all_roles));
	mainDiv.append(buildBuckets('Metadata', aggs.metadata.all_metadata));
	mainDiv.append(buildBuckets('Inputs', aggs.inputs.all_inputs));
	

}

function buildBuckets(name, data) {
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
			if (name == 'Teams') {
				window.currentSearch.team = bucket.key;
			} else if (name == 'Users') {
				if (!window.currentSearch.users) window.currentSearch.users = [];
				window.currentSearch.users.push(bucket.key);
			} else if (name == 'Roles') {
				if (!window.currentSearch.roles) window.currentSearch.roles = [];
				window.currentSearch.roles.push(bucket.key);
			} else {
				build = false;
				drawHistogram(name, bucket);
			}

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
		newSearch.inputs = bucket.key;
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


var AGGS = {
	"teams": {
		"terms" : {
			"field": "teamDomain"
		}
	},

	"users": {
		"nested" : {
			"path": "users"
		},
		"aggs": {
			"all_users": {
				"terms" : {
					"field": "users.email"
				}
			}
		}
	},
	
	"roles": {
		"nested" : {
			"path": "roles"
		},
		"aggs": {
			"all_roles": {
				"terms" : {
					"field": "roles.name"
				}
			}
		}
	},
	
	"metadata": {
		"nested" : {
			"path": "metadata"
		},
		"aggs": {
			"all_metadata": {
				"terms" : {
					"field": "metadata.name"
				}
			}
		}
	},
	
	"inputs": {
		"nested" : {
			"path": "inputData"
		},
		"aggs": {
			"all_inputs": {
				"terms" : {
					"field": "inputData.name"
				}
			}
		}
	}
};