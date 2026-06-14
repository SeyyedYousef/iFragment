package main

import (
	"fmt"
	"io"
	"net/http"
)

func testURL(url string) {
	resp, err := http.Get(url)
	if err != nil {
		fmt.Printf("Error %s: %v\n", url, err)
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	fmt.Printf("Response %s: [%d] %s\n", url, resp.StatusCode, string(b))
}

func main() {
	testURL("https://api.marketapp.ws/v1/collections/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi")
	testURL("https://api.marketapp.ws/v1/collections/telegram-usernames")
	testURL("https://api.marketapp.ws/v1/collections/telegram-numbers")
	testURL("https://api.marketapp.ws/v1/collections/0:b774d95eb20543f18dc00438e8cb4901ee197b102eb4b7b25e79ed498c1baf23")
}
