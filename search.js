window.currentSearch = {
}

function buildSearch() {
	doSearch($("#searchBar")[0].value);

	$("#searchFilters").html(JSON.stringify(window.currentSearch));

	$("#searchBar").keyup(function(event) {
		if(event.keyCode == 13) {
			buildSearch();
		}
	});
}

function doSearch(qry) {
	var subQuery = buildQuery(qry);
	console.log(JSON.stringify(subQuery, null, 2));

	jQuery.ajax({
		method:'POST',
		url: 'http://10.100.1.59:9200/jobs/job/_search',
		data: JSON.stringify({
			'query' : subQuery,
			'aggs': AGGS
		}),
		success: function(data) {
			updateUI(data);
		},
		error: function(error) {
			console.log(error);
		},
		contentType: "application/json; charset=utf-8"
	})
}

function clearStr(str) {
	return str != null && str != undefined && str != '';
}

function buildQuery(qry) {
	var topLevelBool = {};
	topLevelBool["bool"] = {};
	topLevelBool.bool.must = [];

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

	if (clearStr(window.currentSearch.team)) {
		topLevelBool.bool.must.push({
			"term": {
				"teamDomain" : window.currentSearch.team
			}
		});
	}

	var users = window.currentSearch.users;
	if (users != undefined && users != null) {
		users.forEach(function (user) {
			topLevelBool.bool.must.push(nestedBool("users", "users.email", user));
		});
	}

	var roles = window.currentSearch.roles;
	if (roles != undefined && roles != null) {
		roles.forEach(function (role) {
			topLevelBool.bool.must.push(nestedBool("roles", "roles.name", role));
		});
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

	updateAggs(data.aggregations);
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
			if (name == 'Teams') {
				window.currentSearch.team = bucket.key;
			} else if (name == 'Users') {
				if (!window.currentSearch.users) window.currentSearch.users = [];
				window.currentSearch.users.push(bucket.key);
			} else if (name == 'Roles') {
				if (!window.currentSearch.roles) window.currentSearch.roles = [];
				window.currentSearch.roles.push(bucket.key);
			}

			buildSearch();
		})

		link.innerHTML =  bucket.key + " (" + bucket.doc_count + ")";
		$(elDiv).append(link);
		$(newDiv).append(elDiv);
	})
	$(wrapperDiv).append(newDiv)
	return wrapperDiv;
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