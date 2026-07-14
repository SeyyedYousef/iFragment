//go:build ignore

package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

func main() {
	hash := "3fa10b55e1e9b01d48" // Got this from the HTML earlier
	apiUrl := "https://fragment.com/api?hash=" + hash

	data := url.Values{}
	data.Set("query", "thecrypto")
	data.Set("method", "getHistory") // Not sure if this is the method
	data.Set("offset", "45233510000003")

	req, _ := http.NewRequest("POST", apiUrl, strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	client := &http.Client{}
	resp, _ := client.Do(req)
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}
