import cors from "cors";
import express from "express";
import bodyParser from "body-parser";

// Configure middleware
const configureMiddleware = (app) => {
    app.use(cors());
    app.use(express.json());
    app.use(bodyParser.json());
};

export { configureMiddleware };
