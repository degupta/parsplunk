#!/usr/bin/ruby

require 'wordsolver'
require 'webrick'
require 'stringio'
require 'rest-client'

server = WEBrick::HTTPServer.new :Port => 8000
trap 'INT' do server.shutdown end

server.mount_proc '/' do |req, res|
  if req.path == '/jobs/job/_search'

    resp = RestClient.post("http://10.100.1.59:9200/jobs/job/_search",
      req.body,
      'content-type' => 'application/json',
      :accept => :json
    )
    
    str = resp.body
    res.status = resp.code
    res.body = str
    res['Access-Control-Allow-Origin'] = '*'
  end
end

server.start

