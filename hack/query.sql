select od.order_id, UNIX_TIMESTAMP(ordered_time), payment_status, customer_id, customer_lat, customer_lng,
       customer_user_agent, payment_method, od.restaurant_id, item_id, quantity, r.name,
       cuisine, area_id, r.city_id, lat, lng, avg_rating, item_name, is_enabled, item_price, a.name
  from order_details od
  inner join order_items oi on od.order_id = od.order_id
  inner join restaurants r  on r.id = od.restaurant_id
  inner join restaurant_menu rm on rm.id = oi.item_id
  inner join area a on a.id = r.area_id
  limit 100000
  INTO OUTFILE '~/Downloads/parsplunk/hack/orders.csv' FIELDS TERMINATED BY '@@' LINES TERMINATED BY '\n';
