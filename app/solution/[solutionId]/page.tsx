import { SolutionConfiguration } from "@/app/type/types";
import { useState, useEffect } from "react";


export default async function SolutionPage ({params}: {
    params:{
        solutionId:string
    }
}){
    const [loading, setLoading] = useState<boolean>(false);
    const [solution, setSolution] = useState<SolutionConfiguration>();
    

}
