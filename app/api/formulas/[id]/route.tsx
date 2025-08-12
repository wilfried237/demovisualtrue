import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

// Ensure DB connection outside the handler to avoid reconnecting every request
const client = await clientPromise;
const db = client.db("platform_db");
const solutionCollection = db.collection("clients_solutions");

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: solutionId } = await context.params;

    if (!solutionId) {
      return NextResponse.json("id not given", { status: 400 });
    }

    if (!ObjectId.isValid(solutionId)) {
      return NextResponse.json("invalid Id format", { status: 400 });
    }

    const objectId = new ObjectId(solutionId);
    const solutionInfo = await solutionCollection.findOne({ _id: objectId });

    if (!solutionInfo) {
      return NextResponse.json("solutionId does not exist", { status: 404 });
    }

    return NextResponse.json(solutionInfo);
  } catch (error) {
    console.error("Error fetching solution:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch solution",
        details: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 }
    );
  }
}
