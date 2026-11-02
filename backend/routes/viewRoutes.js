const express = require("express");
const router = express.Router();
const { getSiteViews, addSiteView } = require("../controllers/viewController");

router.get("/", getSiteViews);
router.post("/", addSiteView);

module.exports = router;
