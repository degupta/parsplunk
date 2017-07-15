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

bad_hash = Set.new(['tdr1we0', 'tdr1wds', 'tdr1wdm', 'tdr1w99', 'tdr1w7v', 'tdr1w7q', 'tdr1w09', 'tdr1w77', 'tdr1we8', 'tdr1w98', 'tdr1tfp', 'tdr1w42', 'tdr1we9', 'tdr1w0c', 'tdr1w7h', 'tdr1we3', 'tdr1w6c', 'tdr1w6b', 'tdr1w3q', 'tdr1we2', 'tdr1wd0', 'tdr1w4b', 'tdr1wkn', 'tdr1w4c', 'tdr1w10', 'tdr1w40', 'tdr1wdf', 'tdr1wd1', 'tdr1w6g', 'tdr1w7t', 'tdr1w7x', 'tdr1tcz', 'tdr1w44', 'tdr1w7r', 'tdr1w5z', 'tdr1w13', 'tdr1w7y', 'tdr1w7b', 'tdr1w43', 'tdr1wde', 'tdr1wd2', 'tdr1w6z', 'tdr1w9g', 'tdr1wk1', 'tdr1w5b', 'tdr1w53', 'tdr1wkg', 'tdr1w50', 'tdr1tfm', 'tdr1w5h', 'tdr1wkp', 'tdr1w7z', 'tdr1w78', 'tdr1wdj', 'tdr1w1f', 'tdr1tfr', 'tdr1tcv', 'tdr1wdc', 'tdr1w51', 'tdr1w55', 'tdr1wd3', 'tdr1w49', 'tdr1wdb', 'tdr1w7w', 'teperb6', 'tepepy9', 'teper85', 'tepepwt', 'tepepx5', 'tepepxg', 'tepepxr', 'tepepxq', 'teperb0', 'teper6j', 'tepepwv', 'tepepxn', 'tepepwu', 'tepepwj', 'tepepz6', 'tepepzb', 'tepepyg', 'teper2p', 'teper8k', 'tdr1we0', 'tdr1wds', 'tdr1wdm', 'tdr1w99', 'tdr1w7v', 'tdr1w7q', 'tdr1w09', 'tdr1w77', 'tdr1we8', 'tdr1w98', 'tdr1tfp', 'tdr1w42', 'tdr1we9', 'tdr1w0c', 'tdr1w7h', 'tdr1we3', 'tdr1w6c', 'tdr1w6b', 'tdr1w3q', 'tdr1we2', 'tdr1wd0', 'tdr1w4b', 'tdr1wkn', 'tdr1w4c', 'tdr1w10', 'tdr1w40', 'tdr1wdf', 'tdr1wd1', 'tdr1w6g', 'tdr1w7t', 'tdr1w7x', 'tdr1tcz', 'tdr1w44', 'tdr1w7r', 'tdr1w5z', 'tdr1w13', 'tdr1w7y', 'tdr1w7b', 'tdr1w43', 'tdr1wde', 'tdr1wd2', 'tdr1w6z', 'tdr1w9g', 'tdr1wk1', 'tdr1w5b', 'tdr1w53', 'tdr1wkg', 'tdr1w50', 'tdr1tfm', 'tdr1w5h', 'tdr1wkp', 'tdr1w7z', 'tdr1w78', 'tdr1wdj', 'tdr1w1f', 'tdr1tfr', 'tdr1tcv', 'tdr1wdc', 'tdr1w51', 'tdr1w55', 'tdr1wd3', 'tdr1w49', 'tdr1wdb', 'tdr1w7w', 'teperb6', 'tepepy9', 'teper85', 'tepepwt', 'tepepx5', 'tepepxg', 'tepepxr', 'tepepxq', 'teperb0', 'teper6j', 'tepepwv', 'tepepxn', 'tepepwu', 'tepepwj', 'tepepz6', 'tepepzb', 'tepepyg', 'teper2p', 'teper8k'])

ghc = {}
ghr = {}
order_count = 0
avg_sla = 0
item_count = 0

File.open('orders.csv', 'r').read.each_line do |line|
  parts = line.split("@@")

  if doc && parts[0] != doc[:id]
    item_count += doc[:body][:items].size
    doc[:body][:sla_bad] += 1 if doc[:body][:items].size > 3
    avg_sla += doc[:body][:sla_bad]
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
    order_count += 1
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
    ghc[geo_cust] = (ghc[geo_cust] || 0) + 1
    ghr[geo_rest] = (ghr[geo_rest] || 0) + 1

    sla_bad = 0
    sla_bad += 1 if bad_hash.include?(geo_cust)
    sla_bad += 1 if bad_hash.include?(geo_rest)
    sla_bad += 1 if Time.at(ordered_time).hour >= 20 && Time.at(ordered_time).hour <= 23
    doc[:body][:sla_bad] = sla_bad
  else
    doc[:body][:items] << item
  end

  i = i + 1
  if i % 100
    puts "Done #{i}"
  end
end

ghc.each { |k,v| print "'#{k}', " if v >= 100}
ghr.each { |k,v| print "'#{k}', " if v >= 100}

puts
puts

puts "Order Count: #{order_count}, Avg Sla: #{avg_sla.to_f / order_count}, Avg. item Count:  #{item_count.to_f / order_count}"
client.create(doc)