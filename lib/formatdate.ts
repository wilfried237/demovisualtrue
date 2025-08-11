export const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString();
};

export const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleDateString() + " " + new Date(date).toLocaleTimeString();
};

export const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString();
};

export const formatDateAndTime = (date: Date | string) => {
    return new Date(date).toLocaleDateString() + " " + new Date(date).toLocaleTimeString();
};
