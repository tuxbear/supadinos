import { useState } from "react";
import { FormData } from "../Types/types";

export const usePasswordMatch = () => {
    const [isPasswordMatch, setIsPasswordMatch] = useState(true);

    const checkPasswordMatch = (data: FormData) => {
        if (data.password !== data.repeatPassword) {
            setIsPasswordMatch(false);
        } else {
            setIsPasswordMatch(true);
        }
    };

    return { isPasswordMatch, checkPasswordMatch };
};
