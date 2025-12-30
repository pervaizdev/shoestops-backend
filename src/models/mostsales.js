import mongoose from "mongoose";

const mostSalesSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    imageName: { type: String, required: true },
    heading: { type: String, required: true },
    subheading: { type: String, required: true },
    btnText: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },   // <— new

  },
  { timestamps: true }
);

export default mongoose.model("MostSales", mostSalesSchema);
