package com.vanatta.helene.supplies.database.supplies.filters;

import com.vanatta.helene.supplies.database.DeploymentAdvice;
import com.vanatta.helene.supplies.database.auth.CookieAuthenticator;
import com.vanatta.helene.supplies.database.data.CountyDao;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RestController;

/**
 * FilterData are the controls which allow for filtering by site/item/county. These are relatively
 * dynamic data that come from database.
 */
@Slf4j
@RestController
@AllArgsConstructor
public class FilterDataController {
  private final Jdbi jdbi;
  private final CookieAuthenticator cookieAuthenticator;

  @CrossOrigin
  @GetMapping(value = "/supplies/filter-data")
  public FilterDataResponse getFilterData(
      HttpServletRequest request,
      @ModelAttribute(DeploymentAdvice.DEPLOYMENT_STATE_LIST) List<String> stateList) {
    AuthenticatedMode authenticatedMode =
        cookieAuthenticator.isAuthenticated(request)
            ? AuthenticatedMode.AUTHENTICATED
            : AuthenticatedMode.NOT_AUTHENTICATED;
    return getFilterData(authenticatedMode, stateList);
  }

  // @VisibleForTesting
  FilterDataResponse getFilterData(List<String> stateList) {
    return getFilterData(AuthenticatedMode.NOT_AUTHENTICATED, stateList);
  }

  // @VisibleForTesting
  FilterDataResponse getFilterData(AuthenticatedMode authenticatedMode, List<String> stateList) {
    return FilterDataResponse.builder()
        .sites(FilterDataDao.getAllActiveSites(jdbi, authenticatedMode, stateList))
        .counties(CountyDao.fetchActiveCountyList(jdbi, authenticatedMode, stateList))
        .items(FilterDataDao.getAllItems(jdbi))
        .states(stateList)
        .build();
  }
}
