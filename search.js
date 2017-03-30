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
			console.log(data);
		},
		dataType: 'json',
		crossDomain: true,
	})
} 