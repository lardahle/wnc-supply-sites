package com.vanatta.helene.supplies.database.supplies.filters;

import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class FilterDataResponse {
  List<String> sites;
  List<String> counties;
  List<String> items;
  List<String> states;
}
