/**
 * Created by sokolandia on 6/22/15.
 */
if (typeof page !== "undefined" && page.isLoaded && page.location != location.href) {
    page.onWebNavigation();
}
