require 'elasticsearch'
require 'pr_geohash'
require 'set'

client = Elasticsearch::Client.new log: true
client.transport.reload_connections!
client.cluster.health


items = []
doc = nil
i = 0
gh = {}
max = 0

bad_hash = Set.new([
'tdr1w99',
'tdr1wd0',
'tdr1w5z',
'tdr1wdf',
'tdr1we8',
'tdr1w3q',
'tdr1w7z',
'tdr1w7x',
'tepepxn',
'tdr1w7b',
'tdr1w44',
'tdr1w4c',
'tdr1wd8'
])

File.open('orders.csv', 'r').read.each_line do |line|
  parts = line.split("@@")

  if doc && parts[0] != doc[:id]
    doc[:body][:sla_bad] += 1 if doc[:body][:items].size > 4
    client.create(doc)
    doc = nil
  end

  item = {
    item_id: parts[9].to_i,
    quantity: parts[10].to_i,
    item_name: parts[18],
    is_enabled: parts[19] == '1',
    item_price: parts[20].to_f
  }

  if doc == nil
    ordered_time = parts[1].to_i * 1000
    doc = {
      index: 'orders',
      type: 'order',
      id: parts[0],
      body: {
       id: parts[0].to_i,
       ordered_time: ordered_time,
       payment_status: parts[2] == '1',
       customer_id: parts[3].to_i,
       customer_location: {
        lat: parts[4].to_f - 5,
        lon: parts[5].to_f + 2,
       },
       customer_user_agent: parts[6],
       payment_method: parts[7],
       restaurant_id: parts[8].to_i,
       restaurant_name: parts[11],
       cuisine: parts[12].split(',').map { |x| x.delete(' ')},
       area_id: parts[13].to_i,
       city_id: parts[14].to_i,
       restaurant_location: {
        lat: parts[15].to_f - 5,
        lon: parts[16].to_f + 2,
       },
       avg_rating: parts[17].to_f,
       items: [item],
       area_name: parts[21],
      }
    }
    geo_cust = GeoHash.encode(doc[:body][:customer_location][:lat], doc[:body][:customer_location][:lon], 7)
    geo_rest = GeoHash.encode(doc[:body][:customer_location][:lat], doc[:body][:customer_location][:lon], 7)

    sla_bad = 0
    sla_bad += 1 if bad_hash.include?(geo_cust)
    sla_bad += 1 if bad_hash.include?(geo_rest)
    sla_bad += 1 if ordered_time >= 1491062738 && ordered_time <= 1491062738 + 1500
    doc[:body][:sla_bad] = parts[1].to_i
  else
    doc[:body][:items] << item
  end

  i = i + 1
  if i % 100
    puts "Done #{i}"
  end
end

client.create(doc)