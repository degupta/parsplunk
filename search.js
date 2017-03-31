function doSearch(qry) {
	var subQuery = {
		'match': { 
			'_all' : {
				'query': qry,
				'operator': 'and'
			}
		}
	};

	aggs = {
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

	if (qry == null || qry == undefined || qry == '') {
		subQuery = {
			'match_all': { },
		};
	}

	jQuery.ajax({
		method:'POST',
		url: 'http://10.100.1.59:9200/jobs/job/_search',
		data: JSON.stringify({
			'query' : subQuery,
			'aggs': aggs
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

function updateUI(data) {
	var mainDiv = $("#rightTab")[0];
	$(mainDiv).empty();
	data.hits.hits.forEach(function(hit) {
		var code = document.createElement("code");
		code.className = 'prettyprint';

		var mapped = hit._source;
		delete mapped['creatorId']
		delete mapped['teamId']

		if (mapped.roles) {
			mapped["roles"] = mapped["roles"].map(function(role) {
				return role.name;
			})
		}

		if (mapped.users) {
			mapped["users"] = mapped["users"].map(function(user) {
				return user.email;
			})
		}

		code.innerHTML = JSON.stringify(mapped, null, 2);
		newDiv = document.createElement("div");
		newDiv.style = 'margin:20px';
		newDiv.append(code);
		mainDiv.append(newDiv);
	});

	updateAggs(data.aggregations);
}

function updateAggs(aggs) {
	var mainDiv = $("#leftTab")[0];
	$(mainDiv).empty();

	mainDiv.append(buildBuckets('Users', aggs.users.all_users));
	mainDiv.append(buildBuckets('Roles', aggs.roles.all_roles));
	mainDiv.append(buildBuckets('Metadata', aggs.metadata.all_metadata));
	mainDiv.append(buildBuckets('Inputs', aggs.inputs.all_inputs));
	

}

function buildBuckets(name, data) {
	var wrapperDiv = document.createElement("div");
	$(wrapperDiv).append("<p>" + name + "</p>");
	var newDiv = document.createElement("div");
	newDiv.className = 'collapse'

	$(wrapperDiv).click(function(){
        $(newDiv).collapse('toggle');
    });

	data.buckets.forEach(function(bucket) {
		$(newDiv).append("<div style='margin:15px'>" + bucket.key + " (" + bucket.doc_count + ")</div>");
	})
	$(wrapperDiv).append(newDiv)
	return wrapperDiv;
}