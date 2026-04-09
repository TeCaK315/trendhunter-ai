-- FIX: score может быть дробным (4.4), меняем smallint → real
ALTER TABLE block_results ALTER COLUMN score TYPE real;
