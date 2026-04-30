import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import profileRoutes from "./routes/profile.routes";
import reviewRoutes from "./routes/review.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("Backend running");
});

app.use("/api/profile", profileRoutes);
app.use("/api/reviews", reviewRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});