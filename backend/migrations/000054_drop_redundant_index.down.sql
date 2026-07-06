CREATE INDEX idx_sales_momentum ON public.username_sales USING btree (segment, char_length, sale_date DESC) WHERE (is_wash = false);
