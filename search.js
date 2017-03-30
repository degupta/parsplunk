function doSearch(qry) {
	jQuery.ajax({
		url: 'http://localhost:8000/jobs/job/_search',
		data: {
			'query' : {
				'match': {
					'_all' : qry
				}
			}
		},
		success: function(data) {
			updateUI(data);
		},
		dataType: 'json',
		crossDomain: true,
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

		mapped["roles"] = mapped["roles"].map(function(role) {
			return role.name;
		})
		mapped["users"] = mapped["users"].map(function(user) {
			return user.email;
		})

		code.innerHTML = JSON.stringify(mapped);
		newDiv = document.createElement("div");
		newDiv.style = 'margin:20px';
		newDiv.append(code);
		mainDiv.append(newDiv);
	});
}