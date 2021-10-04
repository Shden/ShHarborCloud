#!/bin/bash
echo "Creating tables..."

mysql -uroot -p -D SHDEN < create_db.sql