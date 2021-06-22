import uWS from "uWebSockets.js";
import express from "express";
import assert from "assert";
import expressify from "../src";
import { StatusCodes } from "http-status-codes";
import http from "axios";

const PORT = 9999;
const URL = `http://localhost:${PORT}`;

describe("uWS Express API Compatibility", () => {
  let app: ReturnType<typeof expressify>;
  let server: ReturnType<ReturnType<typeof expressify>['listen']>;

  beforeEach(async () => {
    app = expressify(uWS.App());
    server = app.listen(PORT, () => {});
  });

  afterEach(() => {
    server.close();
  });

  describe("response", () => {
    it("respond to fallback route", async () => {
      const response = await http.get(`${URL}/not_found`, { validateStatus: null });
      assert.strictEqual(StatusCodes.NOT_FOUND, response.status);
      assert.strictEqual("Cannot GET /not_found", response.data);

      const response2 = await http.post(`${URL}/not_found2`, {}, { validateStatus: null });
      assert.strictEqual(StatusCodes.NOT_FOUND, response2.status);
      assert.strictEqual("Cannot POST /not_found2", response2.data);
    });

    it("status()", async () => {
      app.get("/status", (req, res) => {
        res.status(StatusCodes.CREATED).end();
      });

      const response = await http.get(`${URL}/status`);
      assert.strictEqual(StatusCodes.CREATED, response.status);
    });

    it("end()", async () => {
      app.get("/end", (req, res) => {
        res.end("Hello world!");
      });

      const response = await http.get(`${URL}/end`);
      assert.strictEqual("Hello world!", response.data);
    });

    it("hasHeader() / removeHeader() / set()", async () => {
      app.get("/headers", (req, res) => {
        assert.strictEqual(false, res.hasHeader("something"));

        res.set("something", "yes!");
        assert.strictEqual(true, res.hasHeader("something"));

        res.removeHeader("something");
        res.set("definitely", "yes!");

        res.end();
      });

      const response = await http.get(`${URL}/headers`);
      assert.strictEqual("yes!", response.headers['definitely']);
      assert.strictEqual(undefined, response.headers['something']);
    });

    it("json()", async () => {
      app.get("/json", (req, res) => {
        res.json({ hello: "world" });
      });

      const response = await http.get(`${URL}/json`);
      assert.strictEqual("application/json", response.headers['content-type']);
      assert.deepStrictEqual({ hello: "world" }, response.data);
    });

    it("redirect()", async () => {
      app.get("/redirected", (req, res) => {
        res.end("final");
      });

      app.get("/redirect", (req, res) => {
        res.redirect("/redirected");
      });

      const response = await http.get(`${URL}/redirect`);
      assert.strictEqual("final", response.data);
    });

  });

  describe("request", () => {
    it("params", async () => {
      app.get("/params/:one/:two", (req, res) => {
        res.json({
          one: req.params['one'],
          two: req.params['two'],
        });
      });

      assert.deepStrictEqual({
        one: "one",
        two: "two"
      }, (await http.get(`${URL}/params/one/two`)).data);

      assert.deepStrictEqual({
        one: "another",
        two: "1"
      }, (await http.get(`${URL}/params/another/1`)).data);
    });

    it("query", async () => {
      app.get("/query", (req, res) => {
        res.json(req.query);
      });

      const response = await http.get(`${URL}/query?one=1&two=2&three=3&four=4`);
      assert.deepStrictEqual({
        one: "1",
        two: "2",
        three: "3",
        four: "4"
      }, response.data);
    });

    it("method / path / url", async () => {
      app.get("/properties", (req, res) => {
        res.json({
          method: req.method,
          path: req.path,
          url: req.url,
        });
      });

      const { data } = (await http.get(`${URL}/properties?something=true`));
      assert.deepStrictEqual({
        method: "get",
        path: "/properties",
        url: "/properties?something=true",
      }, data);
    });

    it("ip", async () => {
      app.get("/ip", (req, res) => {
        res.json({ ip: req.ip });
      });

      const { data } = (await http.get(`${URL}/ip`));
      assert.strictEqual(39, data.ip.length);
    });

  });

  describe("express.Router compatibility", () => {
    it("should re-use Router routes", async () => {
      const routes = express.Router();
      routes.get("/one", (req, res) => { res.json({ one: "one" }); });
      routes.post("/two", (req, res) => { res.json({ two: "two" }); });
      routes.delete("/three", (req, res) => { res.json({ three: "three" }); });
      app.use("/routes", routes);

      assert.deepStrictEqual({ one: "one" }, (await http.get(`${URL}/routes/one`)).data);
      assert.deepStrictEqual({ two: "two" }, (await http.get(`${URL}/routes/two`)).data);
      assert.deepStrictEqual({ three: "three" }, (await http.get(`${URL}/routes/three`)).data);
    });

  })

});